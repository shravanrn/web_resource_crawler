#!/usr/bin/env python3

import os
import urllib
import simplejson as json
from functools import reduce
from collections import namedtuple
from statistics import mean
from urllib.parse import urlparse


def index(*arg):
  return reduce(lambda x, y: x[y] if x is not None else None, arg)

def strLowerEquals(src, val):
    if src == None:
        return False
    return src.lower() == val

def getExt(url):
    path = urlparse(url).path
    ext = os.path.splitext(path)[1]
    return ext.lower()

def getOrigin(url):
    parsed_uri = urlparse(url)
    result = '{uri.scheme}://{uri.netloc}/'.format(uri=parsed_uri)
    return result.lower()

def isGZipped(urlEntry):
    return strLowerEquals(index(urlEntry, "contentEncoding", "value"), "gzip")

def isCompressed(urlEntry):
    return urlEntry["contentEncoding"] != None

def checkUrlOrContentType(urlEntry, extensions, targetContentType):
    if urlEntry["contentType"] != None:
        return urlEntry["contentType"]["value"].lower() == targetContentType
    urlExt = getExt(urlEntry["url"])
    return urlExt in extensions

def isJPEG(urlEntry):
    ret = checkUrlOrContentType(urlEntry, ["jpg", "jpeg"], "image/jpeg")
    return ret

def isPNG(urlEntry):
    ret = checkUrlOrContentType(urlEntry, ["png"], "image/png")
    return ret

def getGZippedUrls(entry):
    ret = list(filter(lambda x: isGZipped(x), entry["loggedUrls"]))
    return ret

def getCompressedUrls(entry):
    ret = list(filter(lambda x: isCompressed(x), entry["loggedUrls"]))
    return ret

def getJPEGUrls(entry):
    ret = list(filter(lambda x: isJPEG(x), entry["loggedUrls"]))
    return ret

def getPNGUrls(entry):
    ret = list(filter(lambda x: isPNG(x), entry["loggedUrls"]))
    return ret

def getUniqueOrigins(entries):
    entries = [getOrigin(urlEntry["url"]) for urlEntry in entries]
    ret = set(entries)
    return ret

def getUniqueOriginContents(entries):
    entries = [getOrigin(urlEntry["url"]) + (index(urlEntry, "contentType", "value") or "").lower() for urlEntry in entries]
    ret = set(entries)
    return ret

# from separate measurements
sfi_sandbox_memory = 1638
process_sandbox_memory = 2458

def getSFIMemoryOverhead(memory, sandboxes):
    sfi_extraMemory  = sfi_sandbox_memory * sandboxes
    sfi_memoryOverhead = sfi_extraMemory * 100.0 / memory
    return sfi_memoryOverhead

def getProcessMemoryOverhead(memory, sandboxes):
    process_extraMemory = process_sandbox_memory * sandboxes
    process_memoryOverhead = process_extraMemory * 100.0 / memory
    return process_memoryOverhead

def writeSandboxMemoryTo(fileName, key, mem_and_sbx_count_per_entry):
    sfi_overheads = [getSFIMemoryOverhead(mem, sbx_count) for mem, sbx_count in mem_and_sbx_count_per_entry]
    sfi_overhead = mean(sfi_overheads)
    process_overheads = [getProcessMemoryOverhead(mem, sbx_count) for mem, sbx_count in mem_and_sbx_count_per_entry]
    process_overhead = mean(process_overheads)

    with open(fileName, "a") as text_file:
        text_file.write("%s\n" % key)
        text_file.write("SFI Overhead: %s\n" % str(sfi_overhead))
        text_file.write("Process Overhead: %s\n" % str(process_overhead))
        text_file.write("\n")

outputFile = "processed.json"

def sandbox_scheme_1(data):
    # Scheme : Per origin images, per instance gzip
    scheme = [(entry["memory"],
            len(getGZippedUrls(entry)) + len(getUniqueOrigins(getJPEGUrls(entry))) + len(getUniqueOrigins(getPNGUrls(entry)))
        ) for entry in data]
    writeSandboxMemoryTo(outputFile, "PerOriginImagePerInstanceGZip", scheme)

def sandbox_scheme_2(data):
    # Scheme : Per origin images and per origin gzip
    scheme = [(entry["memory"],
            len(getUniqueOrigins(getGZippedUrls(entry))) + len(getUniqueOrigins(getJPEGUrls(entry))) + len(getUniqueOrigins(getPNGUrls(entry)))
        ) for entry in data]
    writeSandboxMemoryTo(outputFile, "PerOriginImagePerOriginGZip", scheme)

def sandbox_scheme_3(data):
    # Scheme : Per origin images and per (origin,content) gzip
    scheme = [(entry["memory"],
            len(getUniqueOriginContents(getGZippedUrls(entry))) + len(getUniqueOrigins(getJPEGUrls(entry))) + len(getUniqueOrigins(getPNGUrls(entry)))
        ) for entry in data]
    writeSandboxMemoryTo(outputFile, "PerOriginImagePerOriginAndContentGZip", scheme)

def sandbox_scheme_4(data):
    # Scheme : Per instance images, per instance compress
    scheme = [(entry["memory"],
            len(getCompressedUrls(entry)) + len(getJPEGUrls(entry)) + len(getPNGUrls(entry))
        ) for entry in data]
    writeSandboxMemoryTo(outputFile, "PerOriginImagePerInstanceCompressed", scheme)

def computeSandboxMemory(data):
    with open(outputFile, "w") as _:
        # clear output file
        pass
    sandbox_scheme_1(data)
    sandbox_scheme_2(data)
    sandbox_scheme_3(data)
    sandbox_scheme_4(data)

def main():
    currDir = os.path.dirname(os.path.realpath(__file__))
    logPath = os.path.join(currDir, "out.json")

    with open(logPath) as f:
        contents = f.read()

    parsedContents = json.loads(contents)
    data = parsedContents["valueStr"]
    computeSandboxMemory(data)


main()

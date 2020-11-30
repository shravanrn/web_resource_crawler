#!/usr/bin/env python3

import os
import urllib
import simplejson as json
from functools import reduce
from collections import namedtuple
from statistics import mean
from urllib.parse import urlparse
from collections import Counter
import tldextract
from PIL import Image
import requests
from io import BytesIO

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

def getSite(url):
    parsed_uri = tldextract.extract(url)
    return parsed_uri.domain.lower()

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

def isCrossOrigin(siteStr, urlEntry):
    mainOrigin = getOrigin(siteStr)
    resourceOrigin = getOrigin(urlEntry["url"])
    ret = mainOrigin != resourceOrigin
    return ret

def getGZippedUrls(entries):
    ret = list(filter(lambda x: isGZipped(x), entries))
    return ret

def getCompressedUrls(entries):
    ret = list(filter(lambda x: isCompressed(x), entries))
    return ret

def getJPEGUrls(entries):
    ret = list(filter(lambda x: isJPEG(x), entries))
    return ret

def getPNGUrls(entries):
    ret = list(filter(lambda x: isPNG(x), entries))
    return ret

def getCrossOriginResources(siteStr, entries):
    ret = list(filter(lambda x: isCrossOrigin(siteStr, x), entries))
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

def writeSandboxMemoryTo(key, mem_and_sbx_count_per_entry):
    sfi_overheads = [getSFIMemoryOverhead(mem, sbx_count) for mem, sbx_count in mem_and_sbx_count_per_entry]
    sfi_overhead = mean(sfi_overheads)
    process_overheads = [getProcessMemoryOverhead(mem, sbx_count) for mem, sbx_count in mem_and_sbx_count_per_entry]
    process_overhead = mean(process_overheads)

    with open("memory_analysis.txt", "a") as text_file:
        text_file.write("%s\n" % key)
        text_file.write("SFI Overhead: %s\n" % str(sfi_overhead))
        text_file.write("Process Overhead: %s\n" % str(process_overhead))
        text_file.write("\n")

def sandbox_scheme_1(data):
    # Scheme : Per origin images, per instance gzip
    scheme = [(entry["memory"],
            len(getGZippedUrls(entry["loggedUrls"])) + len(getUniqueOrigins(getJPEGUrls(entry["loggedUrls"]))) + len(getUniqueOrigins(getPNGUrls(entry["loggedUrls"])))
        ) for entry in data]
    writeSandboxMemoryTo("PerOriginImagePerInstanceGZip", scheme)

def sandbox_scheme_2(data):
    # Scheme : Per origin images and per origin gzip
    scheme = [(entry["memory"],
            len(getUniqueOrigins(getGZippedUrls(entry["loggedUrls"]))) + len(getUniqueOrigins(getJPEGUrls(entry["loggedUrls"]))) + len(getUniqueOrigins(getPNGUrls(entry["loggedUrls"])))
        ) for entry in data]
    writeSandboxMemoryTo("PerOriginImagePerOriginGZip", scheme)

def sandbox_scheme_3(data):
    # Scheme : Per origin images and per (origin,content) gzip
    scheme = [(entry["memory"],
            len(getUniqueOriginContents(getGZippedUrls(entry["loggedUrls"]))) + len(getUniqueOrigins(getJPEGUrls(entry["loggedUrls"]))) + len(getUniqueOrigins(getPNGUrls(entry["loggedUrls"])))
        ) for entry in data]
    writeSandboxMemoryTo("PerOriginImagePerOriginAndContentGZip", scheme)

def sandbox_scheme_4(data):
    # Scheme : Per instance images, per instance compress
    scheme = [(entry["memory"],
            len(getCompressedUrls(entry["loggedUrls"])) + len(getJPEGUrls(entry["loggedUrls"])) + len(getPNGUrls(entry["loggedUrls"]))
        ) for entry in data]
    writeSandboxMemoryTo("PerInstanceImagePerInstanceCompressed", scheme)

def getResourceKey(urlEntry):
    mimeType = index(urlEntry, "contentType", "value")
    if mimeType == None:
        return "missing"
    if mimeType.startswith("text/"):
        # text includes css vs html vs js, so divide further
        key = mimeType.split(";")[0]
    elif mimeType.startswith("image/"):
        # we also care about variety in image types
        key = mimeType.split(";")[0]
    else:
        # other resources are fine
        key = mimeType.split("/")[0]
    return key

def findCrossOriginResourceTypes(entry):
    crossOriginResources = getCrossOriginResources(entry["siteStr"], entry["loggedUrls"])
    resourceTypes = [getResourceKey(res) for res in crossOriginResources]
    ret = dict(Counter(resourceTypes))
    ret["siteStr"] = entry["siteStr"]
    ret["total"] = len(resourceTypes)
    return ret

def sandboxMemoryAnalysis(data):
    with open("memory_analysis.txt", "w") as _:
        # clear output file
        pass
    sandbox_scheme_1(data)
    sandbox_scheme_2(data)
    sandbox_scheme_3(data)
    sandbox_scheme_4(data)

def crossOriginAnalysis(data):
    analysis = [findCrossOriginResourceTypes(entry) for entry in data]
    analysisStr = json.dumps(analysis, indent=4)
    with open("crossOriginAnalysis.json", "w") as text_file:
        text_file.write("%s\n" % analysisStr)

def getJpegDimension(url):
    try:
        response = requests.get(url)
        img = Image.open(BytesIO(response.content))
        ret = img.size
        return ret
    except:
        return (-1, -1)

def getJpegDimensions(entries):
    dims = [getJpegDimension(urlEntry["url"]) for urlEntry in entries]
    return dims

def imageSizeAnalysis(data):
    jpeg_urls = [ getJpegDimensions(getJPEGUrls(entry["loggedUrls"])) for entry in data]
    flat = [item for sublist in jpeg_urls for item in sublist]
    dimensionsStr = json.dumps(flat, indent=4)
    with open("imageSizess.json", "w") as text_file:
        text_file.write("%s\n" % dimensionsStr)

    limit = 480
    small = list(filter(lambda x: x[0] <= limit and x[0] != -1, flat))
    unknown = list(filter(lambda x: x[0] == -1, flat))
    large = list(filter(lambda x: x[0] > limit and x[0] != -1, flat))
    with open("imageSizeAnalysis.json", "w") as text_file:
        text_file.write(
            "Small" + len(small) + "\n" +
            "Large" + len(large) + "\n" +
            "Unknown" + len(unknown) + "\n")

def processLogs(data):
    imageSizeAnalysis(data)
    sandboxMemoryAnalysis(data)
    crossOriginAnalysis(data)

def main():
    currDir = os.path.dirname(os.path.realpath(__file__))
    logPath = os.path.join(currDir, "out.json")

    with open(logPath) as f:
        contents = f.read()

    parsedContents = json.loads(contents)
    data = parsedContents["valueStr"]
    processLogs(data)


main()

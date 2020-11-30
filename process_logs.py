#!/usr/bin/env python3

import os
import os.path
import urllib
import simplejson as json
from functools import reduce, wraps
from collections import namedtuple
from statistics import mean
from urllib.parse import urlparse
from collections import Counter
import tldextract
from PIL import Image
import requests
from io import BytesIO
import errno
import signal

class TimeoutError(Exception):
    pass

def timeout(seconds=10, error_message=os.strerror(errno.ETIME)):
    def decorator(func):
        def _handle_timeout(signum, frame):
            raise TimeoutError(error_message)

        def wrapper(*args, **kwargs):
            signal.signal(signal.SIGALRM, _handle_timeout)
            signal.alarm(seconds)
            try:
                result = func(*args, **kwargs)
            finally:
                signal.alarm(0)
            return result

        return wraps(func)(wrapper)

    return decorator

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

def getJPEGOrPngUrls(entries):
    ret = list(filter(lambda x: isJPEG(x) or isPNG(x), entries))
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

@timeout(60)
def getImageDimension(url):
    response = requests.get(url)
    img = Image.open(BytesIO(response.content))
    ret = img.size
    return ret

def getImageDimensions(entries):
    dims = []
    total = len(entries)
    for i in range(total):
        print("Processing " + str(i) + " of " + str(total))
        try:
            dim = getImageDimension(entries[i]["url"])
        except:
            dim = (-1, -1)
        dims += [ dim ]
    return dims

def imageSizeAnalysis(data):
    imageSizesFile = "imageSizes.json"

    reprocess_existing = true
    if os.path.isfile(imageSizesFile):
        res = input("Image sizes file found: reprocess existing data? y/n")
        if res == "n":
            reprocess_existing = false

    if not reprocess_existing:
        jpeg_urls = [ getJPEGOrPngUrls(entry["loggedUrls"]) for entry in data]
        flat_urls = [item for sublist in jpeg_urls for item in sublist]
        dims = getImageDimensions(flat_urls)
        dimensionsStr = json.dumps(dims, indent=4)
        with open(imageSizesFile, "w") as text_file:
            text_file.write("%s\n" % dimensionsStr)
    else:
        with open(imageSizesFile) as f:
            contents = f.read()
        dims = json.loads(contents)

    limit = 480
    small = list(filter(lambda x: x[0] <= limit and x[0] != -1, dims))
    unknown = list(filter(lambda x: x[0] == -1, dims))
    large = list(filter(lambda x: x[0] > limit and x[0] != -1, dims))
    with open("imageSizeAnalysis.json", "w") as text_file:
        text_file.write(
            "Small: " + str(len(small)) + "\n" +
            "Large: " + str(len(large)) + "\n" +
            "Unknown: " + str(len(unknown)) + "\n")

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

#!/usr/bin/python
import os

currDir = os.path.dirname(os.path.realpath(__file__))
nativeManifestPath = os.path.join(currDir, "webresourcecrawler_native.json")
nativePythonPath = os.path.join(currDir, "webresourcecrawler_native.py")
targetDir = os.path.expanduser("~/.mozilla/native-messaging-hosts")
targetPath = os.path.join(targetDir, "webresourcecrawler_native.json")

with open(nativeManifestPath) as f:
    contents = f.read()

contents = contents.replace('$$', nativePythonPath)

if not os.path.exists(targetDir):
    os.makedirs(targetDir)

with open(targetPath, "w") as text_file:
    text_file.write("%s" % contents)
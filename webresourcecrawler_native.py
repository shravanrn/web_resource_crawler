#!/usr/bin/python -u

# Note that running python with the `-u` flag is required on Windows,
# in order to ensure that stdin and stdout are opened in binary, rather
# than text, mode.

import json
import sys
import struct
import os
import subprocess

# Read a message from stdin and decode it.
def get_message():
    raw_length = sys.stdin.read(4)
    if not raw_length:
        sys.exit(0)
    message_length = struct.unpack('=I', raw_length)[0]
    message = sys.stdin.read(message_length)
    return json.loads(message)


# Encode a message for transmission, given its content.
def encode_message(message_content):
    encoded_content = json.dumps(message_content)
    encoded_length = struct.pack('=I', len(encoded_content))
    return {'length': encoded_length, 'content': encoded_content}


# Send an encoded message to stdout.
def send_message(encoded_message):
    sys.stdout.write(encoded_message['length'])
    sys.stdout.write(encoded_message['content'])
    sys.stdout.flush()

currDir = os.path.dirname(os.path.realpath(__file__))

while True:
    message = get_message()
    if message == "getmem":
        execfile = os.path.join(currDir, "getMem.sh")
        process = subprocess.Popen([execfile], stdout=subprocess.PIPE)
        out, err = process.communicate()
        send_message(encode_message(out))
    else:
        outfile = os.path.join(currDir, "out.json")
        with open(outfile, "w") as text_file:
            text_file.write("%s" % json.dumps(message))
        send_message(encode_message("ok"))
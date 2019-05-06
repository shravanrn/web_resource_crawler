#!/bin/bash

FFCHILDPIDS=$(pgrep "Web Content")
for FFPID in $FFCHILDPIDS
do
echo "$(ps -p ${FFPID} -o rss=)"
done

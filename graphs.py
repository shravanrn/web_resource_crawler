#!/usr/bin/env python3

import json

with open('crossOriginAnalysis.json') as f:
    sites = json.load(f)

# map keys to a list of values we've seen for those keys
master_data = {}

# we care only about media resources
def isMedia(key):
    if key.startswith("image/"):
        return True
    elif key == "font" or key == "video" or key == "audio":
        return True
    else:
        return False

for site in sites:
    for (key, val) in site.items():
        if isMedia(key):
            if key in master_data:
                master_data[key].append(val)
            else:
                master_data[key] = [val]

for key in master_data:
    master_data[key] = sorted(master_data[key], reverse=True)
    for _ in range(len(sites) - len(master_data[key])):
        master_data[key].append(0)
    total_for_key = sum(master_data[key])
    print(key + ': ' + str(total_for_key))

import matplotlib.pyplot as pyplot

"""
def plot_field(fieldname, shortname):
    pyplot.plot(master_data[fieldname])
    if fieldname == 'total':
        pyplot.ylabel('Total # of cross-origin resources')
        pyplot.xlabel('Site in Alexa Top 500 (sorted by total cross-origin resources)')
    else:
        pyplot.ylabel('Total # of cross-origin ' + shortname + ' resources')
        pyplot.xlabel('Site in Alexa Top 500 (sorted by # cross-origin ' + shortname + ' resources)')
    pyplot.savefig(shortname + '.png')
    pyplot.clf()

plot_field('total', 'total')
plot_field('text/javascript', 'JS')
plot_field('text/html', 'HTML')
plot_field('text/css', 'CSS')
plot_field('image', 'image')
plot_field('font', 'font')
"""

import itertools
import statistics

def elementwise_add(*args):
    for values in itertools.zip_longest(*args):
        yield sum(values)

def elementwise_firstminusrest(*args):
    for values in itertools.zip_longest(*args):
        yield values[0] - sum(values[1:])

def plot_stacked_bar():
    """ (old version)
    sites_sorted_by_total = sorted(sites, key=lambda site: site['total'], reverse=True)
    image = [site.get('image', 0) for site in sites_sorted_by_total]
    js = [site.get('text/javascript', 0) for site in sites_sorted_by_total]
    html = [site.get('text/html', 0) for site in sites_sorted_by_total]
    css = [site.get('text/css', 0) for site in sites_sorted_by_total]
    font = [site.get('font', 0) for site in sites_sorted_by_total]
    application = [site.get('application', 0) for site in sites_sorted_by_total]
    missing = [site.get('missing', 0) for site in sites_sorted_by_total]
    total = [site.get('total', 0) for site in sites_sorted_by_total]
    f, ax = pyplot.subplots(figsize=(8,4))
    bar1 = pyplot.bar(range(len(sites)), image, width=1)
    bar2 = pyplot.bar(range(len(sites)), html, bottom=image, width=1)
    bar3 = pyplot.bar(range(len(sites)), css, bottom=list(elementwise_add(image, html)), width=1, color='m')
    bar4 = pyplot.bar(range(len(sites)), font, bottom=list(elementwise_add(image, html, css)), width=1)
    bar5 = pyplot.bar(range(len(sites)), js, bottom=list(elementwise_add(image, html, css, font)), width=1)
    bar6 = pyplot.bar(range(len(sites)), application, bottom=list(elementwise_add(image, html, css, font, js)), width=1)
    bar7 = pyplot.bar(range(len(sites)), missing, bottom=list(elementwise_add(image, html, css, font, js, application)), width=1, color='g')
    bar8 = pyplot.bar(range(len(sites)), list(elementwise_firstminusrest(total, image, html, css, js, application, missing)), bottom=list(elementwise_add(image, html, css, font, js, application, missing)), width=1)
    pyplot.ylabel('Number of cross-origin resources')
    pyplot.xlabel('Site in Alexa Top 500 (sorted by total cross-origin resources)')
    pyplot.legend((bar1, bar2, bar3, bar4, bar5, bar6, bar7, bar8), ('image', 'html', 'css', 'font', 'js', 'application', 'missing', 'other'))
    """
    sites_sorted_by_total = sorted(sites, key=lambda site: sum(val for (key, val) in site.items() if isMedia(key)), reverse=True)
    jpeg = [site.get('image/jpeg', 0) + site.get('image/jpg', 0) for site in sites_sorted_by_total]
    gif = [site.get('image/gif', 0) for site in sites_sorted_by_total]
    png = [site.get('image/png', 0) for site in sites_sorted_by_total]
    other_image = [site.get('image/webp', 0) + site.get('image/x-icon', 0) + site.get('image/svg+xml', 0) + site.get('image/vnd.microsoft.icon', 0) + site.get('image/bmp', 0) for site in sites_sorted_by_total]
    other = [site.get('font', 0) + site.get('video', 0) + site.get('audio', 0) for site in sites_sorted_by_total]
    total_media = [sum(val for (key, val) in site.items() if isMedia(key)) for site in sites_sorted_by_total]
    print()
    print("median media: ", statistics.median(total_media))
    print("mean media: ", statistics.mean(total_media))
    print("highest 10 media: ", total_media[0:10])
    f, ax = pyplot.subplots(figsize=(12,4))
    ax.spines['bottom'].set_position(('data', 0))
    ax.spines['left'].set_position(('data', -1))
    ax.set_xlim(xmin=-1, xmax=500)
    #ax.set_ylim(ymin=0, ymax=500)
    bar_jpeg = ax.bar(range(len(sites)), jpeg, width=1)
    bar_gif = ax.bar(range(len(sites)), gif, bottom=jpeg, width=1)
    bar_png = ax.bar(range(len(sites)), png, bottom=list(elementwise_add(jpeg, gif)), width=1)
    bar_other_image = ax.bar(range(len(sites)), other_image, bottom=list(elementwise_add(jpeg, gif, png)), width=1)
    bar_other = ax.bar(range(len(sites)), other, bottom=list(elementwise_add(jpeg, gif, png, other_image)), width=1)
    ax.set_ylabel('Number of cross-origin media resources')
    ax.set_xlabel('Site in Alexa Top 500 (sorted by total cross-origin media resources)')
    ax.legend((bar_jpeg, bar_gif, bar_png, bar_other_image, bar_other), ('jpeg', 'gif', 'png', 'other image (e.g. svg, webp)', 'other (font, video, audio)'))
    pyplot.savefig('stackedbar.png')
    pyplot.clf()

plot_stacked_bar()

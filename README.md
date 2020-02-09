# Description

This is a web crawler written as firefox extension that scrapes the Alexa top 500 websites and analyses the resources used by the webpage and computes expected memory consumption of various sandboxing schemes. This is written as a Firefox extension. Expected duration: 2 hours.

To setup the crawler, run the install script as shown below once per machine.

```bash
./install.py
```

To run, we will follow the steps as outlined [here](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/) reproduced below

- Kill all open Firefox instances
- Open Firefox browser (we need Firefox version > 65). Then type Type about:debugging in the Firefox URL bar.
- Enter “about:debugging” in the URL bar
- Click “This Firefox”
- Click “Load Temporary Add-on”
- Open file "./manifest.json"
- You will see a new icon in the toolbar next to the address bar (sort of looks like a page icon) with the tooltip WebResourceCrawler. Click this.
- The extension will now go through the Alexa top 500 slowly (spending 10 seconds on each page to account for dynamic resource loading). Do not click on any tabs while Firefox cycles through the webpages. It dumps the raw logs in "LibrarySandboxing/web_resource_crawler/out.json"
- When finished it browses to a blank page. When this happens, run the following commands to process the data

    ```bash
    mkdir -p "./data"
    cd "./data"
    ../process_logs.py
    ```

- You will see the files "crossOriginAnalysis.json" and "memory_analysis.txt" in the folder "./data"

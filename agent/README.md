# TimingPics — Local Watcher Agent

Watches a folder for FinishLynx photo-finish JPEG exports, collects metadata (image time bounds from FinishLynx Remote Control + athlete results from the LIF file), and uploads everything to the TimingPics web API.

## Setup

### 1. Install dependencies

```
pip install -r requirements.txt
```

### 2. Configure

Copy `config.ini.example` to `config.ini` and fill in your values:

```
cp config.ini.example config.ini
```

Key settings:

| Section | Key | Description |
|---|---|---|
| `[meet]` | `name` | Meet name shown on every uploaded image |
| `[meet]` | `date` | Meet date (YYYY-MM-DD) |
| `[finishlynx]` | `watch_folder` | Folder where FinishLynx exports JPEGs |
| `[finishlynx]` | `lif_path` | Full path to the LIF results file |
| `[finishlynx]` | `rc_host` | FinishLynx Remote Control hostname (usually 127.0.0.1) |
| `[finishlynx]` | `rc_port` | FinishLynx Remote Control port (default 16000) |
| `[api]` | `url` | TimingPics API base URL |
| `[api]` | `key` | API key |

### 3. Configure FinishLynx

Two things must be set up in FinishLynx before running the agent:

- **Remote Control:** Enable the Remote Control server in FinishLynx (Event > Camera Settings > Remote Control). Note the port and put it in `config.ini`.
- **Scoreboard script (LSS):** Set up an LSS scoreboard script that exports a JPEG to `watch_folder` when official results are posted. The file must be named `{EventNum}-{Round}-{Heat}.jpg` (e.g. `1-F-1.jpg`). Round codes: `F`=Final, `S`=Semifinal, `P`=Prelim, `Q`=Quarterfinal.

### 4. Start the agent

```
python watcher.py
```

The agent will print a startup banner and begin watching. Each time a new JPEG appears it will:

1. Wait 2 seconds (debounce)
2. Query FinishLynx RC for image time bounds
3. Parse the LIF file for athlete results
4. Upload image + metadata to the API

Press **Ctrl+C** to stop.

### 5. Test without FinishLynx

To verify the API connection and upload pipeline without needing FinishLynx running:

```
python test_upload.py
```

This generates a synthetic 2000×200 photo-finish-style image and uploads it with sample metadata (Event 99, Final, Heat 1, three athletes). After a successful upload visit your API URL and search for "Smith" to find the test photo.

## File overview

| File | Purpose |
|---|---|
| `watcher.py` | Main entry point; watchdog observer loop |
| `lif_parser.py` | Parses LIF results files (two format variants) |
| `finishlynx.py` | FinishLynx Remote Control TCP client |
| `uploader.py` | Multipart upload to the TimingPics API |
| `test_upload.py` | Standalone upload test with synthetic image |
| `config.ini` | Your local configuration (not committed) |
| `config.ini.example` | Template — copy and fill in |
| `requirements.txt` | Python dependencies |

## LIF file formats

The agent supports two common FinishLynx LIF formats automatically:

**Format 1** (standard FinishLynx export to Meet Manager):
```
 Event= 1, Round=F, Heat= 1
 1,Smith John            ,Westfield HS         ,10.84  ,  ,   +0.0, ,       ,       , 101,5,
```

**Format 2** (alternate compact format):
```
0,1,F,1
1,10.84,101,Smith,John,Westfield HS
```

If a heat is not found in the LIF the agent logs a warning and uploads the image anyway with an empty athletes list.

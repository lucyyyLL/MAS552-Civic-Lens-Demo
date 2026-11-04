"""Read API keys from the secrets folder.

Keys are read straight from files and passed to clients explicitly. They are never copied into
environment variables or into this repository.
"""

import os
import re
from pathlib import Path

# The secrets folder sits next to the repo (City Science/secrets). Only its *path* can be
# overridden, e.g. when the folder is mounted into a container at a different location.
SECRETS_DIR = Path(
    os.environ.get("CIVIC_LENS_SECRETS_DIR", Path(__file__).resolve().parents[2] / "secrets")
)

# Matches a single `NAME="value"` line
_ASSIGNMENT = re.compile(r"""^\s*\w+\s*=\s*["']?(.*?)["']?\s*$""")


def read_key(filename: str) -> str | None:
    """Return the key stored in `filename`, or None if the file does not exist.

    The file may hold either the bare key or a single `NAME="value"` line.
    """
    path = SECRETS_DIR / filename
    if not path.is_file():
        return None
    text = path.read_text(encoding="utf-8-sig").strip()
    match = _ASSIGNMENT.match(text)
    return match.group(1) if match else text

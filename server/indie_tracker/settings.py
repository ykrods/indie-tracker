import os
from pathlib import Path


def env_cast_bool(key, default):
    if key not in os.environ:
        return default

    if os.environ[key] in ['1', 'TRUE', 'YES']:
        return True
    if os.environ[key] in ['0', 'FALSE', 'NO']:
        return False

    return default


STATIC_DIR = Path(__file__).parent.parent / '_static'

PORT = int(os.environ.get('PORT', 18000))

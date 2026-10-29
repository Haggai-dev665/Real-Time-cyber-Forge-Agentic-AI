"""Compatibility entry point for the staged cloud workflow.

Use --stage data, then --stage smoke, then --stage train. See README.md.
"""
from cloud_job import main

if __name__ == "__main__":
    main()

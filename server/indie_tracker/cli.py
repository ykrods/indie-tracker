import os
import argparse
import sys

from dulwich.repo import Repo
from dulwich.errors import NotGitRepository

from indie_tracker.server import serve


def type_git_repo(path):
    try:
        with Repo(path):
            return path
    except NotGitRepository:
        raise argparse.ArgumentTypeError(f'"{path}" is not a git repository')


def make_parser():
    parser = argparse.ArgumentParser(
        description='Start http server of indie-tracker',
    )
    parser.add_argument(
        'repo',
        nargs="?",
        default=".",
        type=type_git_repo,
        help="git repository path (default: current directory)"
    )
    return parser


def main():
    args = make_parser().parse_args()

    serve(os.path.abspath(args.repo))

    return 0


if __name__ == '__main__':
    sys.exit(main())

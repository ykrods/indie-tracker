========
README
========

Project management system for prototying or personal project on local server

Features
===========

* Issue management
* Wiki
* Support reStructuredText
* Support `Mermaid <http://mermaid-js.github.io/mermaid/>`_
* Using git as datastore, therefore you can copy or backup easily to exec `git clone` or `git push`

Important notice
===================

* This project is still experimental / in the proof-of-concept stage.
* Data compatibility may be lost in the future upgrading (especially issue data).

setup
========

::

   docker pull ykrods/indie-tracker:latest
   mkdir example-proj
   cd example-proj
   git init
   git config user.name "your name"
   git config user.email "your email"
   docker run --rm -p 18000:18000 -v `pwd`:/example-proj ykrods/indie-tracker /example-proj
   # visit http://localhost:18000

Similar projects
==================

* `fossil <https://fossil-scm.org/home/doc/trunk/www/index.wiki>`_
* `git-bug <https://github.com/MichaelMure/git-bug>`_

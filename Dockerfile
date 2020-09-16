FROM python:3.8
LABEL maintainer="ykrods" \
      version="0.1.0"

ARG app_dir="/opt/indie-tracker"
ARG debug

RUN pip install -U pip setuptools wheel tox && \
  useradd --create-home ituser && \
  mkdir -p ${app_dir}

COPY . ${app_dir}/

WORKDIR ${app_dir}

RUN if [ "$debug" != "1" ]; then echo "PROD" && \
    pip install -e ./server ; fi

RUN if [ "$debug" = "1" ]; then echo "DEBUG" && \
    chown -R ituser:ituser /home/ituser/indie-tracker ; fi

USER ituser
WORKDIR /home/ituser

RUN if [ "$debug" = "1" ]; then echo "DEBUG" && \
    cd indie-tracker/server && \
    python -m venv ~/venv && \
    ~/venv/bin/pip install -e . && \
    tox --notest ; fi

ENTRYPOINT ["indie-tracker"]

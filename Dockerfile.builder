FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    build-essential clang flex bison g++ gawk gettext git \
    libncurses5-dev libssl-dev python3-setuptools rsync swig \
    unzip zlib1g-dev file wget sudo python3-distutils golang-go \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m builduser && echo "builduser ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

USER builduser
WORKDIR /openwrt

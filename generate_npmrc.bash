#!/bin/bash

touch .npmrc
echo "registry=http://${REGISTRY_URL}" >> .npmrc
echo "always-auth=true" >> .npmrc
echo "//${REGISTRY_URL}:_auth = ${ENCODED_PASSWORD}" >> .npmrc
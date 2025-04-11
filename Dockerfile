# Correct the Node.js version
ARG NODE_VERSION=22.13.0

################################################################################
# Use node image for base image for all stages.
FROM node:${NODE_VERSION}-alpine AS base

# Set working directory for all build stages.
WORKDIR /app

################################################################################
FROM base AS dist

# Install git to be able to install dependencies from git repositories
RUN --mount=type=cache,target=/var/cache/apk apk add bash git

# Copy only package.json and package-lock
COPY package*.json ./

RUN --mount=type=secret,id=npmrc,target=./.npmrc \
    --mount=type=cache,target=/root/.npm npm install

# Copy necessary files for building the application
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src

RUN --mount=type=secret,id=npmrc,target=./.npmrc \
    --mount=type=cache,target=/root/.npm npm run build

################################################################################
# install production dependencies
FROM base AS install

# Install git to be able to install dependencies from git repositories
RUN --mount=type=cache,target=/var/cache/apk apk add git

# Copy only package.json and package-lock from the dist stage
COPY --from=dist /app/package.json /app/package-lock.json ./

# RUN yarn install --production --frozen-lockfile
RUN --mount=type=secret,id=npmrc,target=./.npmrc \
    --mount=type=cache,target=/root/.npm npm ci

################################################################################
# Create a new stage to run the application with minimal runtime dependencies
# where the necessary files are copied from the install stage.
FROM base AS final

ARG stage_arg
ARG CODE_VERSION
ARG CODE_COMMITID

# Run the application as a non-root user.
USER node

# Use production node environment by default.
ENV STAGE=$stage_arg
ENV CODE_VERSION=${CODE_VERSION}
ENV CODE_COMMITID=${CODE_COMMITID}

# Copy necessary files from previous stages
COPY --from=dist /app/dist ./dist
COPY --from=dist /app/package.json ./
COPY --from=install /app/node_modules  ./node_modules

# Copy only necessary files for running the application
COPY config/config*.yaml ./config/

COPY entrypoint.sh ./

# Run the application.
ENTRYPOINT ["./entrypoint.sh"]

FROM node:24.18.0-bookworm-slim AS build
WORKDIR /workshop/InteractiveWorkshop
COPY app/package*.json ./
RUN npm ci
COPY app/ ./
RUN npm run build && npm prune --omit=dev

FROM node:24.18.0-bookworm-slim
ENV NODE_ENV=production
WORKDIR /workshop/InteractiveWorkshop
COPY --from=build --chown=node:node /workshop/InteractiveWorkshop/node_modules ./node_modules
COPY --from=build --chown=node:node /workshop/InteractiveWorkshop/dist ./dist
COPY --from=build --chown=node:node /workshop/InteractiveWorkshop/server ./server
COPY --from=build --chown=node:node /workshop/InteractiveWorkshop/package.json ./package.json
COPY --chown=node:node guide/ /workshop/
USER node
EXPOSE 4310
CMD ["node", "server/index.mjs"]
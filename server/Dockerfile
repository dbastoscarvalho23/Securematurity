# Backend AnkoraOne (API + funções + workflows + agente).
# Construir a partir da raiz do repositório:  docker build -f server/Dockerfile -t ankoraone-api .
FROM node:22-slim

ENV NODE_ENV=production \
    PORT=3001 \
    BASE44_DIR=/app/base44 \
    STORAGE_LOCAL_DIR=/data/uploads

WORKDIR /app/server
COPY server/package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY server/src ./src
COPY server/scripts ./scripts
COPY base44 /app/base44
# As funções em base44/functions são módulos ES escritos em TypeScript.
RUN echo '{"type":"module"}' > /app/base44/package.json \
 && mkdir -p /data/uploads && chown -R node:node /data

USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]

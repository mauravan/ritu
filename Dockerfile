FROM node:20-slim

WORKDIR /app

# Install playwright deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

RUN npx playwright install --with-deps chromium

COPY . .

RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]

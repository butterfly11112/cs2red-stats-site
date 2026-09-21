# Official Playwright image already has Chromium + all the system
# libraries it needs preinstalled — avoids fighting apt-get for browser
# dependencies on the hosting platform.
FROM mcr.microsoft.com/playwright:v1.47.0-jammy

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server.js"]

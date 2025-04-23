FROM node:20-slim

# Variáveis para não pedir confirmação durante instalação
ENV DEBIAN_FRONTEND=noninteractive

# Instala dependências para Chromium e PM2
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Define variável de ambiente para o Puppeteer usar o Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Cria diretório da aplicação
WORKDIR /app

# Copia package.json e package-lock.json
COPY package*.json ./

# Instala dependências do projeto e PM2
RUN npm ci \
    && npm install -g pm2 \
    && npm cache clean --force

# Copia o restante da aplicação
COPY . .

# Expõe a porta
EXPOSE 3000

# Comando para iniciar com PM2
CMD ["pm2-runtime", "ecosystem.config.js"]

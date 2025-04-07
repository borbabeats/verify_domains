FROM node:16-slim

# Variáveis para não pedir confirmação durante instalação
ENV DEBIAN_FRONTEND=noninteractive

# Instala dependências para Chrome e PM2
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
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
    && rm -rf /var/lib/apt/lists/*

# Instala o Chrome
RUN wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && apt-get update \
    && apt-get install -y ./google-chrome-stable_current_amd64.deb \
    && rm google-chrome-stable_current_amd64.deb

# Cria diretório da aplicação
WORKDIR /app

# Copia e instala dependências do projeto
COPY package*.json ./
RUN npm install && npm run postinstall || true

# Instala PM2 globalmente
RUN npm install -g pm2

# Copia o restante da aplicação
COPY . .

# Expõe a porta
EXPOSE 3000

# Comando para iniciar com PM2
CMD ["pm2-runtime", "pm2.config.js"]

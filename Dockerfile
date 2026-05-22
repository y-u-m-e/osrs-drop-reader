FROM node:22-slim

# Install system deps for sharp and tesseract
RUN apt-get update && apt-get install -y \
  tesseract-ocr \
  libtesseract-dev \
  libvips-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/

EXPOSE 3000

CMD ["node", "src/index.js"]

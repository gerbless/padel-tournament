#!/bin/bash

# Script de verificación rápida para el proyecto de torneos de pádel

echo "🎾 Padel Tournament - Verificación de Docker"
echo "============================================="
echo ""

# Verificar que Docker esté instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado"
    echo "   Instala Docker desde: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose no está instalado"
    exit 1
fi

echo "✅ Docker está instalado"
echo "✅ Docker Compose está instalado"
echo ""

# Verificar estructura de archivos
echo "📁 Verificando estructura de archivos..."

files=(
    "docker-compose.yml"
    "backend/Dockerfile"
    "backend/package.json"
    "frontend/Dockerfile"
    "frontend/package.json"
    "frontend/nginx.conf"
)

all_files_exist=true
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file NO ENCONTRADO"
        all_files_exist=false
    fi
done

if [ "$all_files_exist" = false ]; then
    echo ""
    echo "❌ Faltan archivos. Verifica la estructura del proyecto."
    exit 1
fi

echo ""
echo "✅ Todos los archivos necesarios están presentes"
echo ""

# Opciones
echo "Opciones:"
echo "1. Levantar aplicación (docker-compose up -d)"
echo "2. Ver logs (docker-compose logs -f)"
echo "3. Detener aplicación (docker-compose down)"
echo "4. Ver estado de contenedores (docker-compose ps)"
echo "5. Salir"
echo ""
read -p "Selecciona una opción (1-5): " option

case $option in
    1)
        echo ""
        echo "🚀 Levantando aplicación..."
        docker-compose up -d
        echo ""
        echo "✅ Aplicación iniciada!"
        echo "   Frontend: http://localhost"
        echo "   Backend API: http://localhost:3000"
        echo ""
        echo "Usa 'docker-compose logs -f' para ver los logs"
        ;;
    2)
        echo ""
        docker-compose logs -f
        ;;
    3)
        echo ""
        echo "🛑 Deteniendo aplicación..."
        docker-compose down
        echo "✅ Aplicación detenida"
        ;;
    4)
        echo ""
        docker-compose ps
        ;;
    5)
        echo "Adiós! 👋"
        exit 0
        ;;
    *)
        echo "Opción inválida"
        exit 1
        ;;
esac

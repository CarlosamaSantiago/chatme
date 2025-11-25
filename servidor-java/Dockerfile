# Dockerfile para el servidor Java con ZeroC Ice
FROM gradle:7.6-jdk17 AS build

WORKDIR /app

# Copiar archivos de configuración y wrapper de Gradle
COPY build.gradle settings.gradle gradle.properties ./
COPY gradle ./gradle
COPY gradlew gradlew.bat ./

# Hacer gradlew ejecutable
RUN chmod +x ./gradlew

# Copiar código fuente
COPY src ./src

# Instalar ZeroC Ice (slice2java debe estar disponible)
# Nota: En producción, es mejor pre-compilar los archivos .ice
# y copiar solo los archivos generados
RUN apt-get update && apt-get install -y \
    zeroc-ice-all-dev \
    && rm -rf /var/lib/apt/lists/*

# Compilar el proyecto
RUN ./gradlew build --no-daemon

# Imagen de runtime
FROM eclipse-temurin:17-jre-jammy

WORKDIR /app

# Instalar ZeroC Ice runtime
RUN apt-get update && apt-get install -y \
    zeroc-ice-all-runtime \
    && rm -rf /var/lib/apt/lists/*

# Copiar el JAR compilado
COPY --from=build /app/build/libs/*.jar app.jar

# Exponer puerto (será asignado por Render)
EXPOSE 10000

# Variables de entorno por defecto
ENV PORT=10000
ENV ICE_HOST=0.0.0.0

# Ejecutar la aplicación
CMD ["java", "-jar", "app.jar"]


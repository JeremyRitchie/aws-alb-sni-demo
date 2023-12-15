FROM arm64v8/nginx:mainline-alpine
EXPOSE 8080
COPY index.html /usr/share/nginx/html
COPY nginx.conf /etc/nginx/
CMD ["nginx", "-g", "daemon off;"]
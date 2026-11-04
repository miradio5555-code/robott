FROM python:3.13-alpine
WORKDIR /app
COPY bridge.py business.py cloud.py supervisor.py ./
CMD ["python", "-u", "bridge.py"]

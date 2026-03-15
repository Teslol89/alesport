from fastapi import FastAPI

app = FastAPI(title="Alesport API")

@app.get("/")
def root():
    return {"message": "Alesport backend running"}
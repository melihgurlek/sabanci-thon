from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import torch
import numpy as np
import pandas as pd
from src.data_loader import load_and_preprocess_data
from src.model import ClinicalTwinGNN
from src.explain import explain_prediction
import os

app = FastAPI(title="OncoGraph X API")

# Enable CORS for the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load resources globally
DATA, DF, FEATURE_NAMES = load_and_preprocess_data('data')
MODEL = ClinicalTwinGNN(in_channels=DATA.num_features, hidden_channels=64)
MODEL_PATH = 'models/clinical_twin_gnn.pth'

if os.path.exists(MODEL_PATH):
    MODEL.load_state_dict(torch.load(MODEL_PATH, map_location=torch.device('cpu')))
MODEL.eval()

SMOKING_MAP = {0: 'Never', 1: 'Former', 2: 'Current', 3: 'Unknown'}
TUMOR_SITE_MAP = {0: 'Oral Cavity', 1: 'Oropharynx', 2: 'Hypopharynx', 3: 'Larynx', 4: 'Other'}
GRADING_MAP = {0: 'G1 (Well)', 1: 'G2 (Moderate)', 2: 'G3 (Poor)', 3: 'G4 (Undiff)'}

@app.get("/api/patients")
async def get_patients():
    patients = []
    raw = pd.read_csv('data/clinical.csv')
    targets = pd.read_csv('data/targets.csv')
    pathological = pd.read_csv('data/pathological.csv')
    meta = raw.merge(targets[['patient_id','recurrence','survival_status']], on='patient_id', how='left')
    meta = meta.merge(pathological[['patient_id','grading','pT_stage','primary_tumor_site']], on='patient_id', how='left')
    for _, row in meta.iterrows():
        patients.append({
            "id": str(row['patient_id']),
            "sex": int(row['sex']) if pd.notna(row['sex']) else 0,
            "age": int(row['age_at_initial_diagnosis']) if pd.notna(row['age_at_initial_diagnosis']) else 0,
            "smoking": SMOKING_MAP.get(int(row['smoking_status']) if pd.notna(row['smoking_status']) else 0, 'Unknown'),
            "recurrence": str(row['recurrence']) if pd.notna(row['recurrence']) else 'no',
            "survival_status": str(row['survival_status']) if pd.notna(row['survival_status']) else 'unknown',
            "grading": GRADING_MAP.get(int(row['grading']) if pd.notna(row['grading']) else 0, 'Unknown'),
            "tumor_site": TUMOR_SITE_MAP.get(int(row['primary_tumor_site']) if pd.notna(row['primary_tumor_site']) else 0, 'Other'),
            "pT_stage": int(row['pT_stage']) if pd.notna(row['pT_stage']) else 0,
        })
    return {"patients": patients}

@app.get("/api/predict/{patient_id}")
async def predict(patient_id: str):
    # Ensure DF patient_id are strings for comparison
    df_ids = DF['patient_id'].astype(str).values
    if patient_id not in df_ids:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found in {df_ids[:5]}")
    
    # Find the index using string comparison
    node_idx = DF.index[DF['patient_id'].astype(str) == patient_id][0]
    
    # Inference
    with torch.no_grad():
        out_rec, out_sur = MODEL(DATA.x, DATA.edge_index)
        rec_prob = torch.softmax(out_rec[node_idx], dim=-1)[1].item()
        sur_rate = out_sur[node_idx].item()

    # Explanation
    feat_imp, edge_imp, edge_idx = explain_prediction(MODEL, DATA, int(node_idx))
    
    # Top 10 features
    importance_list = [
        {"feature": FEATURE_NAMES[i], "importance": float(feat_imp[i])}
        for i in range(len(FEATURE_NAMES))
    ]
    importance_list = sorted(importance_list, key=lambda x: x['importance'], reverse=True)[:10]

    # Clinical Twin Map Data
    connected_edges = (edge_idx[0] == node_idx) | (edge_idx[1] == node_idx)
    relevant_edges = edge_idx[:, connected_edges]
    relevant_weights = edge_imp[connected_edges]
    
    top_indices = np.argsort(relevant_weights)[-5:]
    
    # Resolve sex for target node (0=male, 1=female)
    target_sex = int(DF.iloc[node_idx]['sex']) if 'sex' in DF.columns else 0
    nodes = [{"id": str(patient_id), "label": f"Patient {patient_id}", "type": "target", "sex": target_sex}]
    links = []
    
    for idx in top_indices:
        u, v = relevant_edges[:, idx]
        neighbor_idx = v if u == node_idx else u
        neighbor_idx = int(neighbor_idx)
        neighbor_id = str(DF.iloc[neighbor_idx]['patient_id'])
        neighbor_survival = DF.iloc[neighbor_idx]['survival_status']
        
        neighbor_sex = int(DF.iloc[neighbor_idx]['sex']) if 'sex' in DF.columns else 0
        nodes.append({
            "id": neighbor_id,
            "label": f"Twin {neighbor_id}",
            "type": "twin",
            "survival": neighbor_survival,
            "sex": neighbor_sex
        })
        links.append({
            "source": str(patient_id),
            "target": neighbor_id,
            "value": float(relevant_weights[idx])
        })

    return {
        "patient_id": patient_id,
        "recurrence_prob": rec_prob,
        "survival_rate": sur_rate,
        "feature_importance": importance_list,
        "graph": {
            "nodes": nodes,
            "links": links
        }
    }

print("Model is Prepreaining and Training. Takes 1 minute.")
import src.train_model as train_model
whatwillfetch=train_model.main()
@app.get("/api/patientInfo")
def get_patient_info():    
    return whatwillfetch #{"data":data, "output": output, "model_metadata": model_metadata}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

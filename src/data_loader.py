import pandas as pd
import numpy as np
import torch
from torch_geometric.data import Data
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.impute import SimpleImputer
import os

def load_and_preprocess_data(data_dir='data'):
    # 1. Load Data
    clinical = pd.read_csv(os.path.join(data_dir, 'clinical.csv'))
    blood = pd.read_csv(os.path.join(data_dir, 'blood.csv'))
    pathological = pd.read_csv(os.path.join(data_dir, 'pathological.csv'))
    targets = pd.read_csv(os.path.join(data_dir, 'targets.csv'))

    # 2. Merge Data
    df = clinical.merge(blood, on='patient_id', how='inner')
    df = df.merge(pathological, on='patient_id', how='inner')
    df = df.merge(targets, on='patient_id', how='inner')

    # 3. Target Definitions
    # Task A: Recurrence (0: no, 1: yes)
    df['recurrence_label'] = df['recurrence'].map({'no': 0, 'yes': 1}).fillna(0).astype(int)

    # Task B: Survival Score (Normalized)
    # Strategy: (days / max_days) * (1.2 if living else 0.8)
    max_days = df['days_to_last_information'].max()
    df['survival_score'] = (df['days_to_last_information'] / max_days)
    df.loc[df['survival_status'] == 'dead', 'survival_score'] *= 0.8
    df.loc[df['survival_status'] == 'living', 'survival_score'] *= 1.2
    # Clip to [0, 1]
    df['survival_score'] = df['survival_score'].clip(0, 1)

    # 4. Preprocessing
    # Identify column types
    blood_cols = [c for c in blood.columns if c != 'patient_id']
    pathology_cols = [c for c in pathological.columns if c != 'patient_id']
    clinical_cols = [c for c in clinical.columns if c != 'patient_id']
    
    # Impute Blood (Median)
    blood_imputer = SimpleImputer(strategy='median')
    df[blood_cols] = blood_imputer.fit_transform(df[blood_cols])

    # Impute Pathology (Mode)
    path_imputer = SimpleImputer(strategy='most_frequent')
    df[pathology_cols] = path_imputer.fit_transform(df[pathology_cols])

    # Feature Engineering / Encoding
    # For categorical columns that are not IDs or targets
    cat_cols = ['sex', 'primarily_metastasis', 'smoking_status', 'hpv_association_p16']
    for col in cat_cols:
        if col in df.columns:
            df[col] = LabelEncoder().fit_transform(df[col].astype(str))

    # Scale Numerical Features
    num_cols = blood_cols + clinical_cols + ['infiltration_depth_in_mm']
    num_cols = [c for c in num_cols if c in df.columns and c not in cat_cols]
    scaler = StandardScaler()
    df[num_cols] = scaler.fit_transform(df[num_cols])

    # 5. Graph Construction (The Clinical Twin)
    # Nodes: patients in df
    node_features = df[num_cols + cat_cols].values
    x = torch.tensor(node_features, dtype=torch.float)

    # Edges: Same primary_tumor_site AND pT_stage
    edge_index = []
    edge_attr = []

    patient_indices = df.index.tolist()
    for i in range(len(patient_indices)):
        for j in range(i + 1, len(patient_indices)):
            p1 = df.iloc[i]
            p2 = df.iloc[j]
            
            if p1['primary_tumor_site'] == p2['primary_tumor_site'] and p1['pT_stage'] == p2['pT_stage']:
                # Similarity Weight based on grading and pN_stage
                # We'll use 1 / (1 + abs(diff))
                grading_sim = 1.0 / (1.0 + abs(float(p1['grading']) - float(p2['grading'])))
                pn_sim = 1.0 / (1.0 + abs(float(p1['pN_stage']) - float(p2['pN_stage'])))
                weight = (grading_sim + pn_sim) / 2.0
                
                edge_index.append([i, j])
                edge_index.append([j, i])
                edge_attr.append([weight])
                edge_attr.append([weight])

    if not edge_index:
        # Fallback: connect everyone with a very low weight if no twins found
        # Or just empty edges for now (PyG handles this)
        edge_index = torch.empty((2, 0), dtype=torch.long)
        edge_attr = torch.empty((0, 1), dtype=torch.float)
    else:
        edge_index = torch.tensor(edge_index, dtype=torch.long).t().contiguous()
        edge_attr = torch.tensor(edge_attr, dtype=torch.float)

    # Targets
    y_recurrence = torch.tensor(df['recurrence_label'].values, dtype=torch.long)
    y_survival = torch.tensor(df['survival_score'].values, dtype=torch.float).view(-1, 1)

    data = Data(x=x, edge_index=edge_index, edge_attr=edge_attr, y_recurrence=y_recurrence, y_survival=y_survival)
    
    return data, df, num_cols + cat_cols

if __name__ == "__main__":
    data, df, features = load_and_preprocess_data('../data')
    print(f"Graph constructed with {data.num_nodes} nodes and {data.num_edges} edges.")
    print(f"Features: {len(features)}")
    print(f"Recurrence balance: {df['recurrence_label'].value_counts().to_dict()}")

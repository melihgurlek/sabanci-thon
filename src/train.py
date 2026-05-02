import torch
import torch.nn.functional as F
from src.data_loader import load_and_preprocess_data
from src.model import ClinicalTwinGNN
import os

def train_model():
    # Setup
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    data, df, feature_names = load_and_preprocess_data('data')
    data = data.to(device)
    
    model = ClinicalTwinGNN(in_channels=data.num_features, hidden_channels=64).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01, weight_decay=5e-4)
    
    model.train()
    for epoch in range(100):
        optimizer.zero_grad()
        out_recurrence, out_survival = model(data.x, data.edge_index)
        
        loss_recurrence = F.cross_entropy(out_recurrence, data.y_recurrence)
        loss_survival = F.mse_loss(out_survival, data.y_survival)
        
        # Combine losses
        loss = loss_recurrence + loss_survival
        
        loss.backward()
        optimizer.step()
        
        if epoch % 10 == 0:
            print(f'Epoch {epoch:03d}, Loss: {loss.item():.4f} (Rec: {loss_recurrence.item():.4f}, Sur: {loss_survival.item():.4f})')

    # Save model
    if not os.path.exists('models'):
        os.makedirs('models')
    torch.save(model.state_dict(), 'models/clinical_twin_gnn.pth')
    print("Model saved to models/clinical_twin_gnn.pth")
    
    return model, data, feature_names

if __name__ == "__main__":
    train_model()

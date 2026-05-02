import torch
import torch.nn.functional as F
from torch_geometric.nn import SAGEConv

class ClinicalTwinGNN(torch.nn.Module):
    def __init__(self, in_channels, hidden_channels, out_channels_recurrence=2):
        super(ClinicalTwinGNN, self).__init__()
        
        # Encoder: GraphSAGE
        self.conv1 = SAGEConv(in_channels, hidden_channels)
        self.conv2 = SAGEConv(hidden_channels, hidden_channels)
        
        # Dual Heads
        # Head 1: Recurrence (Binary Classification)
        self.recurrence_head = torch.nn.Linear(hidden_channels, out_channels_recurrence)
        
        # Head 2: Survival (Regression/Probability - 0 to 1)
        self.survival_head = torch.nn.Sequential(
            torch.nn.Linear(hidden_channels, hidden_channels // 2),
            torch.nn.ReLU(),
            torch.nn.Linear(hidden_channels // 2, 1),
            torch.nn.Sigmoid()
        )

    def forward(self, x, edge_index, edge_weight=None):
        # Feature aggregation
        x = self.conv1(x, edge_index)
        x = F.relu(x)
        x = F.dropout(x, p=0.2, training=self.training)
        
        x = self.conv2(x, edge_index)
        x = F.relu(x)
        
        # Latent representation for explanations
        self.latent = x
        
        # Heads
        recurrence_out = self.recurrence_head(x)
        survival_out = self.survival_head(x)
        
        return recurrence_out, survival_out

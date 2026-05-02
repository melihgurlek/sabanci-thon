import torch
from torch_geometric.explain import Explainer, GNNExplainer

def explain_prediction(model, data, node_index):
    # Setup Explainer
    import torch.nn.functional as F
    
    # We need a wrapper to handle the dual output for the explainer
    # The explainer expects a single output. We'll wrap the model to return recurrence probs.
    class RecurrenceWrapper(torch.nn.Module):
        def __init__(self, model):
            super().__init__()
            self.model = model
        def forward(self, x, edge_index, **kwargs):
            rec, _ = self.model(x, edge_index)
            return F.softmax(rec, dim=-1)

    wrapped_model = RecurrenceWrapper(model)

    # Setup Explainer
    explainer = Explainer(
        model=wrapped_model,
        algorithm=GNNExplainer(epochs=50), # Reduced epochs for faster dashboard
        explanation_type='model',
        node_mask_type='attributes',
        edge_mask_type='object',
        model_config=dict(
            mode='multiclass_classification',
            task_level='node',
            return_type='probs',
        ),
    )
    
    explanation = explainer(data.x, data.edge_index, index=node_index)
    
    # Feature importance
    feature_importance = explanation.node_mask.sum(dim=0).cpu().numpy()
    
    # Edge importance (for Clinical Twins)
    edge_importance = explanation.edge_mask.cpu().numpy()
    
    return feature_importance, edge_importance, explanation.edge_index

# Kubernetes Deployment Guide

1. **Start Minikube**
   ```bash
   minikube start --cpus=4 --memory=6g
   ```
2. **Build container images inside the Minikube Docker daemon**
   ```bash
   eval "$(minikube docker-env)"
   docker build -t careconnect/notification-service:latest ../notification-service
   docker build -t careconnect/appointment-service:latest ../appointment-service
   ```
3. **Create namespace and deploy services**
   ```bash
   kubectl apply -f namespace.yaml
   kubectl apply -f notification.yaml
   kubectl apply -f appointment.yaml
   ```
4. **Verify deployment health**
   ```bash
   kubectl get pods -n careconnect
   kubectl get services -n careconnect
   ```
5. **Access services**
   - Port-forward:
     ```bash
    kubectl port-forward -n careconnect svc/notification-service 3000:3000
     kubectl port-forward -n careconnect svc/appointment-service 3100:3100
     ```
   - Or via Minikube tunnel:
     ```bash
     minikube service appointment-service -n careconnect --url
     ```

6. **Kubernetes dashboard**
   ```bash
   minikube dashboard
   ```
   Inspect the `careconnect` namespace to observe pods, ReplicaSets, and services.

7. **Cleanup**
   ```bash
   kubectl delete -f appointment.yaml -n careconnect
   kubectl delete -f notification.yaml -n careconnect
   kubectl delete -f namespace.yaml
   minikube stop
   ```

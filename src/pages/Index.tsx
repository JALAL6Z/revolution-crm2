// La route "/" est gérée par AppLayout → Dashboard.
// Ce fichier reste pour compat mais n'est plus utilisé.
import { Navigate } from "react-router-dom";
const Index = () => <Navigate to="/" replace />;
export default Index;

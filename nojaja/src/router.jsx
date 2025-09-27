// src/router.jsx
import { createBrowserRouter } from "react-router-dom";
import Home from "./components/Home.jsx";
import Signin from "./components/Signin.jsx";
import Signup from "./components/Signup.jsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/signin",
    element: <Signin />,
  },
  {
    path: "/signup",
    element: <Signup />,
  },
]);

export default router;
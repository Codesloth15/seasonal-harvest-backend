import { Router } from "express";
import { getUser, getUsers } from "../controller/user.controller.js";
import authorize from "../middleware/auth.middleware.js";
import arcjetMiddleware from "../middleware/arcjet.middleware.js";
const userRouter = Router();


//GET /users->static parameters

//variable.get(handler)=>result.send({objectname:'value'}));
userRouter.get('/',arcjetMiddleware,getUsers);

//GET /users/:id->dynamic parameters
userRouter.get('/:id',authorize,arcjetMiddleware,getUser);

userRouter.post('/',(req,res)=>res.send({title:'PUT new data'}))

userRouter.put('/id',(req,res)=>res.send({title:'UPDATE new data'}))

userRouter.delete('/id',(req,res)=>res.send({title:'DELETE data'}));

export default userRouter
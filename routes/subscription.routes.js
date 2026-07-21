import { Router } from "express";
import authorize from "../middleware/auth.middleware.js";
import { createSubscription,getUserSubscription } from "../controller/subscription.controller.js";

const subscriptionRouter = Router();

subscriptionRouter.get('/',(req,res)=>res.send({title:'Get all subscription'}));
subscriptionRouter.get('/:id',(req,res)=>res.send({title:'Get subscription details'}));
subscriptionRouter.get('/user/:id',authorize,getUserSubscription);
subscriptionRouter.post('/',authorize,createSubscription);
subscriptionRouter.put('/:id',(req,res)=>res.send({title:'Update subscription'}));
subscriptionRouter.put('/:id/cancel',(req,res)=>res.send({title:'Cancel subscrption'}));
subscriptionRouter.delete('/:id',(req,res)=>res.send({title:'Delete subscrption'}));
subscriptionRouter.get('/upcoming-renewals',(req,res)=>res.send({title:'Upcoming renewals'}))
export default subscriptionRouter;
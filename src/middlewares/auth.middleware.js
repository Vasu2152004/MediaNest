import { Apierror } from "../utils/Apierror.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"
import { User } from "../models/user.model.js";

export const verifyJWT =  asyncHandler(async(req,res,next)=>{
   try {
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","")
 
    if(!token){
     throw new Apierror(401,"Unauthorized Request")
    }
    console.log("Tokentype: "+typeof token)
    console.log("Token: "+token)
    const decodedinfo = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)
    const user = await User.findById(decodedinfo?._id).select("-password -refreshToken")
 
    if(!user){
     throw new Apierror(401,"Invalid access token")
    }
 
    req.user = user;
    next()
   } catch (error) {
    throw new Apierror(401,error?.mesaage||"Invalid Access token")
   }
})
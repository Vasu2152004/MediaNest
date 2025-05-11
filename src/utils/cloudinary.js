import { v2 as cloudinary } from "cloudinary";
import fs from "fs"; 
import { Apierror } from "./Apierror";



    // Configuration
    cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
        api_key: process.env.CLOUDINARY_API_KEY, 
        api_secret: process.env.CLOUDINARY_API_SECRET // Click 'View API Keys' above to copy your API secret
    });
    
    const uploadoncloudinary = async (localfilepath)=>{
        try {
            if (!localfilepath) {
                return null;
            }
           const response= await cloudinary.uploader.upload(localfilepath, {resource_type: "auto"});
           fs.unlinkSync(localfilepath);
            return response;
        } catch (error) {
            fs.unlinkSync(localfilepath)
            console.log("cloudinary upload error")
            return null;
        }
    }


    const deleteoncloudinary = async(localpath)=>{
        try {
             const parts = localpath.split('/')
             const publicidwithext = parts.slice(parts.indexof('upload') +1).join('/')
             const publicId = publicidwithext.replace(/\.[^/.]+$/,"")
    
            const result = await cloudinary.uploader.destroy(publicId)
            if(!result){
                throw new Apierror(500,"can not delete file from the cloudinary")
            }
            return result;
        } catch (error) {
            console.log("error occurs in cloudinary.js and the error is ",error)
            throw new Apierror(500,"cloudinary deletion is failed")
        }

    }

export {uploadoncloudinary,deleteoncloudinary}
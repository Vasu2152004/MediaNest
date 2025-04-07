import connectDB from "./db/index.js";
import dotenv from "dotenv"

dotenv.config({
    path: './env'
}
)
connectDB()
.then(()=>{
    app.on("error",(error)=>{
        console.log("Error Occurs while listening app ",error);
        throw error;
    })
    app.listen(process.env.PORT || 8000 , ()=>{
        console.log(`Serever is Running on Port: ${process.env.PORT}`)
    })
})
.catch((err)=>{
    console.log(`Error Occurs in MONGO Conn  ${err}`)
})
const Sequelize = require("sequelize");

require("dotenv").config()
const db_name=process.env.DB_NAME
const db_user = process.env.DB_USER
const db_pass=process.env.DB_PASS


const sequelize = new Sequelize(db_name,db_user, db_pass,{
    dialect:"mysql",
    host:"localhost",

    define: {
        freezeTableName:true
    }
});

module.exports = sequelize;


"use strict";

var canvasContext = null;
var canvasElement = null;
var particleArray = [];

function randrange(m, n){return Math.random()*(n - m) + m;}


function initializeCanvas(){
    canvasElement = document.getElementById("simulation")
    canvasContext = canvasElement.getContext("2d");


    //setInterval(spawnRoutine(), 7);

    setInterval(function() {if (Math.random() <= 0.8) {particleArray.push({x:randrange(0,window.innerWidth),y:window.innerHeight,bias:randrange(-1,1),size:randrange(2,8),power:randrange(3,10)});}},20);


    window.requestAnimationFrame(advanceFrame);

}


function advanceFrame(){

    let canvasitem = document.querySelector("canvas");

    //define drawable region
    canvasElement.width = canvasitem.offsetWidth;
    canvasElement.height = canvasitem.offsetHeight;

    canvasContext.fillStyle = "white";

    //iterate through every single thing
    for(var i=0; i < particleArray.length; i++){
        //"weighing" the bias function because even a random float between 1 and -1 is too much
        particleArray[i].x += particleArray[i].bias/6;
        //manipulating "float" speed
        particleArray[i].y += particleArray[i].size*-0.3;

        //start draw routine
        canvasContext.beginPath();
        canvasContext.rect(particleArray[i].x, particleArray[i].y, particleArray[i].size, particleArray[i].size);

        //simulate "decay"
        particleArray[i].size -= 0.02;
        //cull particles with downward velocity
        if (particleArray[i].size < 0){particleArray.splice(i,1);}
        //randomly apply an increasing bias
        if (Math.random() <= 0.1) {particleArray[i].bias -= randrange(-1,1);}
        
        //draw routine
        canvasContext.fill();
        canvasContext.stroke();
    }
    //advance the frame after iter
    window.requestAnimationFrame(advanceFrame);
}


console.log("success!");

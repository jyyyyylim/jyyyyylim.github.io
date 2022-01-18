"use strict";


//initialize vars for canvas drawing
var canvasContext = null;
var canvasElement = null;
var particleArray = [];
var Cursor = [];

//misc vars for objects
const cursorRadius = 10;
const offsetX = Math.sqrt(cursorRadius);
const offsetY = Math.sqrt(cursorRadius);
const nodeActivationDistance= 300;


//equations for the simulation
function opacityScale(s) {return 0.7-(1/s)}
function nodeDistancetoMouse(x, y) {return Math.abs(Math.sqrt(((x-Cursor.xpos)**2)+((y-Cursor.ypos)**2)));}
function randrange(m, n){return Math.random()*(n - m) + m;}
function biasRelativetoCursor(xpos, ypos) {return Cursor.xpos-xpos;}


function initializeCanvas(){
    canvasElement = document.getElementById("simulation")
    canvasContext = canvasElement.getContext("2d");

    //skip particle spawning- a fix to counter V8 flooding the page with particles if focus is returned 
    setInterval(function() {if (Math.random() <= 0.8 && particleArray.length < 100) {particleArray.push({x:randrange(0,window.innerWidth),y:window.innerHeight,bias:randrange(-1,1),size:randrange(2,8),power:randrange(3,10)});}},10);
    window.requestAnimationFrame(advanceFrame);
}

//recursive main loop for frame compositing

//targeted effect: vague resemblance to the "rising ashes of a fire"
//this is relatively easy to implement due to the nature of burning ashes being lifted by heat- dependent on its own size
//hence the rate of ascension is just a function of vertical velocity to particle "draw size"    

function advanceFrame(){
    //update position array
    onmousemove = function(m){Cursor.xpos = m.clientX; Cursor.ypos = m.clientY;}

    let canvasitem = document.querySelector("canvas");

    //define drawable region
    canvasElement.width = canvasitem.offsetWidth;
    canvasElement.height = canvasitem.offsetHeight;

    //constants for draw
    canvasContext.fillStyle = "white";
    canvasContext.strokeStyle = "white";
    canvasContext.lineWidth = 1;

    //iterate through every single thing
    for(var i=0; i < particleArray.length; i++){

        //"weighing" the bias function because even a random float between 1 and -1 is too much
        particleArray[i].x += particleArray[i].bias/6;
        //manipulating "float" speed
        //particleArray[i].y += particleArray[i].size*-0.7;

        //>"ash particle" draw routine
        canvasContext.beginPath();
        canvasContext.rect(particleArray[i].x, particleArray[i].y, particleArray[i].size, particleArray[i].size);

        //simulate "decay"
        particleArray[i].size -= 0.025;
        //cull particles with downward velocity
        if (particleArray[i].size < 0){particleArray.splice(i,1);}
        //randomly apply an increasing bias
        //if (Math.random() <= 0.1) {particleArray[i].bias -= randrange(-1,1);}

        canvasContext.fill();

        //>experimental proximity draw
        if (nodeDistancetoMouse(particleArray[i].x, particleArray[i].y) > nodeActivationDistance) {
            if (Math.random() <= 0.1) {particleArray[i].bias -= randrange(-1,1);}
            particleArray[i].y += particleArray[i].size*-0.8;
        } else {
            particleArray[i].bias -= biasRelativetoCursor(particleArray[i].x, particleArray[i].y)/800;
            if (Cursor.ypos > particleArray[i].y){
                particleArray[i].y += particleArray[i].size*-0.9;
            } else {
                particleArray[i].y += particleArray[i].size*-0.7;}

            canvasContext.strokeStyle = "rgba(255, 255, 255," + opacityScale(particleArray[i].size) + ")";
            //start draw routine for "node paths"
            canvasContext.beginPath();
            canvasContext.moveTo(Cursor.xpos-offsetX, Cursor.ypos+offsetY);
            canvasContext.lineTo(particleArray[i].x, particleArray[i].y);
            canvasContext.stroke();
        }
    }

    canvasContext.strokeStyle = "white";
    //>draw routine for cursor
    canvasContext.beginPath();
    canvasContext.arc(Cursor.xpos-offsetX, Cursor.ypos+offsetY, cursorRadius, 0, 2*Math.PI);
    canvasContext.stroke();

    //frame is finally advanced when all DRAW procedures go through
    window.requestAnimationFrame(advanceFrame);
}

console.log("success!");

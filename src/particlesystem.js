"use strict";


//rebuilding from bias to x and y-vel
//space assumed to be frictionless
//yvel added to initial sum?
//xvel assumed to be 0 excludign starting bias

//initialize vars for canvas drawing
var canvasContext = null;
var canvasElement = null;
var particleArray = [];
var leaders= [];
var spatialHash = [];
var Cursor = [];
var m1down = true;

//init constants
const cursorRadius = 10;
const offsetX = Math.sqrt(cursorRadius);
const offsetY = Math.sqrt(cursorRadius);
const nodeActivationDistance= (window.innerWidth*window.innerHeight)**0.385;


const bounceCoeff = 1;
const decayCoeff = 2;
const decayRate = 0.07;
const deviationThreshold = 0.01;

const cullThresholdX = window.innerWidth;
const cullThresholdY = window.innerHeight;


//calc max particles exist (ratio between desired amount/screen space)
const maxParticles = window.innerWidth/10;

//update position array
onmousemove = function(m){Cursor.xpos = m.clientX; Cursor.ypos = m.clientY;}

//equations for the simulation
function opacityScale(s) {return 0.7-(1/s)}
function nodeDistancetoMouse(x, y) {return Math.abs(Math.sqrt(((x-Cursor.xpos)**2)+((y-Cursor.ypos)**2)));}
function randrange(m, n){return Math.random()*(n - m) + m;}
function xvelRelativetoCursor(xpos) {return Cursor.xpos-xpos;}
function yvelRelativetoCursor(ypos) {return Cursor.ypos-ypos;}

function xvelRelativetoLeader(xpos) {return leaders[0].x-xpos;}
function yvelRelativetoLeader(ypos) {return leaders[0].y-ypos;}

function bitwiseFlip(n) {return ~n+1;}

function isPositive(n) {
    if (n>0){return true;} 
    else {return false;}
}

function hypotenuse(a, b) {return Math.sqrt((a**2)+(b**2))}

function nodeDistancetoLeader(lx, ly, x, y) {return Math.abs(Math.sqrt(((x-lx)**2)+((y-ly)**2)));}

//dbg
var lastTimestamp= 0;

function returnFrametime(){return performance.now()-lastTimestamp;}
function updateframetimeBuffer(){lastTimestamp= performance.now();}

//frametime units are in milliseconds
function returnFPS(frametime){return Math.round((1000/frametime))}

var lastBufferedAvg = 0;
function initFrametimeAvg(frametime){lastBufferedAvg = frametime;} 
function returnAvgFrametime(frametime){
    lastBufferedAvg = (lastBufferedAvg+frametime)/2;
    return lastBufferedAvg;
}



/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////fundamentals///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function initEntities(upperLimit, xspeed, yspeed, minsize, maxsize) {
        while (particleArray.length < upperLimit) {
            particleArray.push({
                //x: randrange(0,scaledPartitionWidth), 
                //y: randrange(0,scaledPartitionHeight), 
                x: randrange(0,window.innerWidth), 
                y: randrange(0,window.innerHeight), 
                xvel: randrange(bitwiseFlip(xspeed), xspeed), 
                yvel: randrange(bitwiseFlip(yspeed), yspeed), 
                size: randrange(minsize, maxsize), 
                region: [Math.round(randrange(0, partitionColAmount-1)), Math.round(randrange(0, partitionRowAmount-1))]
            });
        }
}



///////////////////////////////////////////////////////////////////////////////////////////////////////////////////spatial algorithms//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//spatialhash

//var partitionColAmount= 36;
//var partitionRowAmount= 18;

var partitionColAmount= 16;
var partitionRowAmount= 9;

var scaledPartitionWidth= window.innerWidth/partitionColAmount;
var scaledPartitionHeight= window.innerHeight/partitionRowAmount;


function checkDirection(indx){
    return [!isPositive(particleArray[indx].xvel), !isPositive(particleArray[indx].yvel)]
}


//intended to be only called when confirmed to be an edge tile
//returns array of 2 bools, N/S | E/W
function edgeFacing(region){
    var facing= [];
    if (region[0]==0){facing.push(true)}
    else if (region[0]==(partitionColAmount-1)){facing.push(false)}
    else{facing.push(undefined)}
    
    if (region[1]==0){facing.push(true)}
    else if (region[1]==(partitionRowAmount-1)){facing.push(false)}
    else{facing.push(undefined)}

    return facing;
}



function determineRegion(particleIndex){
    //return particleArray[particleIndex].region[0]
    return particleArray[particleIndex].region[0]+" - "+particleArray[particleIndex].region[1];
}

function returnAdj(region){
    var adjacencies= [];
    for(var regx=-1; regx<2; regx++){for(var regy=-1; regy<2; regy++){adjacencies.push([(regx+region[0]), (regy+region[1])]);}} return adjacencies;
}

function initSpatialHash(){for (var x=0; x<partitionColAmount; x++){for (var y=0; y<partitionRowAmount; y++){spatialHash[x+"-"+y]= []}}}

function populateSpatialHash(indx){
    spatialHash[particleArray[indx].region[0]+"-"+particleArray[indx].region[1]].push(indx);
    //console.log("trace: pushed "+i);
}






function updateSpatialInfo(indx, region){
    //edge skipping because particles do not traverse beyond its borders
        
    //check x, then check y
    //advanced bounds dependent on particle direction and relative bounds
    //issue: particles still escape bounds for brief period after 
    //ensures all region data manipulation is centralized


    //solution: skip everything thats being done on here if its on the edge
    //issue: moving within the edge is still possible

    //this few blocks only handle cell traversal
    if(particleArray[indx].x<0){
        //left
        particleArray[indx].x= scaledPartitionWidth+particleArray[indx].x;
        updateSpatialHash(indx, region, [true, undefined]);
    }
    else if(particleArray[indx].x>scaledPartitionWidth && particleArray[indx].xvel>0){
        //right
        particleArray[indx].x-=scaledPartitionWidth;
        updateSpatialHash(indx, region, [false, undefined]);
    }

    if(particleArray[indx].y<0 && particleArray[indx].yvel<0){
        //up
        particleArray[indx].y= scaledPartitionHeight+particleArray[indx].y;
        updateSpatialHash(indx, region, [undefined, true]);
    }
    else if(particleArray[indx].y>scaledPartitionHeight && particleArray[indx].yvel>0){
        //down
        particleArray[indx].y-=scaledPartitionHeight;    
        updateSpatialHash(indx, region, [undefined, false]);
    }
}


//operates on a "former region->update direction" basis
//called when updateSpatialInfo detects a particle escape from bounds of a region
function updateSpatialHash(indx, regionBucket, direction){
    //first remove the indx from regionbucket
        var regionKey=regionBucket[0]+"-"+regionBucket[1];
        spatialHash[regionKey].splice((spatialHash[regionKey].indexOf(indx)), 1);

        if (direction[0]!==undefined){
            //moving right
            if (direction[0]==false && (particleArray[indx].region[0])!=(partitionColAmount-1)){particleArray[indx].region[0]+= 1;}
            //moving left
            if (direction[0]==true && (particleArray[indx].region[0])!=(0)){particleArray[indx].region[0]-= 1;}
        }
        
        if (direction[1]!==undefined){
            //moving down
            if (direction[1]==false && (particleArray[indx].region[1])!=(partitionRowAmount-1)){particleArray[indx].region[1]+=1;}
            //moving up
            if (direction[1]==true){particleArray[indx].region[1]-=1;}
        }
        particleRegistryCommit(indx);
}

function antiAliasedCollision(indx){
    //for large vel values to work as expected (due to "cell skipping" pertinent to this layout of relative and abs coordinates)
    //abs coord needs to be derived before next position can be calculated
}

function particleRegistryCommit(indx){
    console.log('something ('+indx+') has been pushed to region registry '+particleArray[indx].region[0]+'-'+particleArray[indx].region[1]);
    spatialHash[particleArray[indx].region[0]+'-'+particleArray[indx].region[1]].push(indx);
}









//returns truism for if a particle enters an edge region
function regionisEdge(region){
    if(region[0]==0 || region[1]==0 || region[0]==(partitionColAmount-1) || region[1]==(partitionRowAmount-1)){    
        return true;
    } else {return false;}
}

//with context to spatialhash, this method is only called when particle is on an edge
//returns an "absolute" coordinate on the canvas for bound checking
//axis- nominally accepts binary: 0: x, 1: y
//isZero: skips complex checking for particles on region zero
function returnScaledCoordinate(relativepos, axis, region, isZero){
    var coordinateRelative= relativepos;
    if (isZero!==undefined){
        if (axis==0){return (region[0]*scaledPartitionWidth)+coordinateRelative;}
        else {return (region[1]*scaledPartitionHeight)+coordinateRelative;}
    } else {
        if (axis==0){return (region[0]*scaledPartitionWidth)+coordinateRelative;}
        else {return (region[1]*scaledPartitionHeight)+coordinateRelative;}
    }
}




/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////draws//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function drawParticleRect(context, x_pos, y_pos, size){context.beginPath(); context.rect(x_pos, y_pos, size, size); context.fill();}
function drawRect_region(context, xpos_rel, ypos_rel, region, size){context.beginPath(); context.rect((xpos_rel+((region[0])*scaledPartitionWidth)), (ypos_rel+((region[1])*scaledPartitionHeight)), size, size); context.fill();}
function drawDot_region(context, col, xpos_rel, ypos_rel, region, size){context.fillStyle = col; context.beginPath(); context.arc((xpos_rel+((region[0])*scaledPartitionWidth)), (ypos_rel+((region[1])*scaledPartitionHeight)), size/2, 0, 2*Math.PI); context.fill();}

function drawDot(context, col, xpos_rel, ypos_rel, size){context.fillStyle = col; context.beginPath(); context.arc(xpos_rel, ypos_rel, size/2, 0, 2*Math.PI); context.fill();}



function highlightRegion(context, region){context.fillStyle = "rgba(0, 255, 0, 0.1)"; context.fillRect((scaledPartitionWidth*region[0]), (scaledPartitionHeight*region[1]), scaledPartitionWidth, scaledPartitionHeight);}
function adjHighlight(context, indx){
    var adjacencyList= returnAdj(particleArray[indx].region);
    context.fillStyle = "rgba(255, 0, 0, 0.16)"; 
    //context.fillRect((scaledPartitionWidth*adjacencyList[1][0]), (scaledPartitionHeight*adjacencyList[1][1]), scaledPartitionWidth, scaledPartitionHeight);
    
    for (var n=0; n < adjacencyList.length; n++){
        context.fillRect((scaledPartitionWidth*adjacencyList[n][0]), (scaledPartitionHeight*adjacencyList[n][1]), scaledPartitionWidth, scaledPartitionHeight);
    }
}

function populationHighlight(region, threshold){
    //dumb idea: try/except array pos accessing instead of len comparison

}


function pointlabel(context, indx){context.fillText(indx+": "+determineRegion(indx), ((particleArray[indx].x+(particleArray[indx].region[0]*scaledPartitionWidth))+5), ((particleArray[indx].y+(particleArray[indx].region[1]*scaledPartitionHeight))+12));}
function drawRegion(context){
    for(var i=0; i<partitionColAmount; i++){context.moveTo((scaledPartitionWidth*i), 0); context.lineTo((scaledPartitionWidth*i), window.innerHeight); context.stroke();}
    for(var i=0; i<partitionRowAmount; i++){context.moveTo(0, (scaledPartitionHeight*i)); context.lineTo(window.innerWidth, (scaledPartitionHeight*i)); context.stroke();}
}



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////mainloop//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function initializeCanvas(){
    canvasElement = document.getElementById("simulation")
    canvasContext = canvasElement.getContext("2d");
    initFrametimeAvg(returnFrametime());

    initSpatialHash();

    //setInterval(function() {if (Math.random() <= 0.8 && particleArray.length < maxParticles) {particleArray.push({x: randrange(0,scaledPartitionWidth), y: randrange(0,scaledPartitionHeight), xvel: randrange(-5, 5), yvel: randrange(-5, 5), size: randrange(3,7), region: [Math.round(randrange(0, partitionColAmount)), Math.round(randrange(0, partitionRowAmount))]});}},1);
    initEntities(800, 8, 8, 3, 7);
    //initEntities()
    for(var i=0; i < particleArray.length; i++){populateSpatialHash(i);}

    //window.requestAnimationFrame(spatialhash_random);
    window.requestAnimationFrame(smokeCell);
}


//recursive main loop for frame compositing
function risingAshes(){

        //skip particle spawning- a fix to counter V8 flooding the page with particles if focus is returned 
    //setInterval(function() {if (Math.random() <= 0.8 && particleArray.length < 100) {particleArray.push({x:randrange(0,window.innerWidth),y:window.innerHeight,xvel:randrange(-1,1),size:randrange(2,8),power:randrange(3,10)});}},10);
    //alter: use x and y-components instead of xvel
    setInterval(function() {
        if (Math.random() <= 0.8 && particleArray.length < maxParticles) {
            particleArray.push({

                x:randrange(0,window.innerWidth),
                y:window.innerHeight,
                xvel:randrange(-0.05,0.05),
                yvel:2,
                size:randrange(1,5)
            
            });}}
            ,1);

    let canvasitem = document.querySelector("canvas");

    //define drawable region
    canvasElement.width = canvasitem.offsetWidth;
    canvasElement.height = canvasitem.offsetHeight;

    //constants for draw
    canvasContext.fillStyle = "white";
    canvasContext.strokeStyle = "white";
    canvasContext.lineWidth = 1;

    //no fuck you sir i will never use 12pt
    canvasContext.font = "0.6rem times new roman";

    for(var i=0; i < particleArray.length; i++){
        particleArray[i].x += particleArray[i].xvel;

        if (Math.random() <= 0.1) {particleArray[i].xvel -= randrange(-1,1);}
        if (particleArray[i].x < 0 || particleArray[i].x > window.innerWidth) {
            particleArray[i].xvel = bitwiseFlip(particleArray[i].xvel);
        }

        //>"ash particle" draw routine
        canvasContext.beginPath();
        canvasContext.rect(particleArray[i].x, particleArray[i].y, particleArray[i].size, particleArray[i].size);
        
        //simulate "decay"
        particleArray[i].size -= 0.015;
        //cull particles with downward velocity
        if (particleArray[i].size < 0){particleArray.splice(i,1);}

        canvasContext.fill();


        //>experimental proximity draw
        //physics block
        var distBuffer = nodeDistancetoMouse(particleArray[i].x, particleArray[i].y);

        if (distBuffer > nodeActivationDistance) {
            //executed when mouse ypos is above particle
            particleArray[i].y += particleArray[i].size*-0.8;

        } else {
            //executed when mouse ypos is below particle
            particleArray[i].xvel -= xvelRelativetoCursor(particleArray[i].x, particleArray[i].y)/800;

            if (Cursor.ypos > particleArray[i].y){
                particleArray[i].y += particleArray[i].size*-0.9;
            } else {
                particleArray[i].y += particleArray[i].size*-0.4;
            }

            canvasContext.strokeStyle = "rgba(255, 255, 255," + opacityScale(particleArray[i].size) + ")";
            
            //start draw routine for "node paths"
            //canvasContext.beginPath();
            //canvasContext.moveTo(Cursor.xpos - offsetX, Cursor.ypos + offsetY);
            //canvasContext.lineTo(particleArray[i].x + (particleArray[i].size / 2), particleArray[i].y + (particleArray[i].size));
            canvasContext.fillText((Math.floor(distBuffer)), particleArray[i].x+10, particleArray[i].y+10);

            //canvasContext.stroke();
        }
        

    }

    canvasContext.strokeStyle = "white";
    //>draw routine for cursor
    canvasContext.beginPath(); 
    canvasContext.arc(Cursor.xpos - offsetX, Cursor.ypos + offsetY, cursorRadius, 0, 2*Math.PI);
    canvasContext.stroke();

    canvasContext.beginPath(); 
    canvasContext.arc(Cursor.xpos - offsetX, Cursor.ypos + offsetY, nodeActivationDistance, 0, 2*Math.PI);
    canvasContext.stroke();

    //frame is finally advanced when all DRAW procedures go through
    window.requestAnimationFrame(risingAshes);
}

function mousetests(){

    setInterval(function() {
        if (Math.random() <= 0.8 && particleArray.length < maxParticles*1.5) {
            particleArray.push({x: randrange(0,window.innerWidth), y: randrange(0,window.innerHeight), xvel: 0, yvel: 0, size: randrange(3,7)});}},1);

    let canvasitem = document.querySelector("canvas");
    //define drawable region
    canvasElement.width = canvasitem.offsetWidth;
    canvasElement.height = canvasitem.offsetHeight;

    //constants for draw
    canvasContext.fillStyle = "white";
    canvasContext.strokeStyle = "white";
    canvasContext.lineWidth = 1;

    canvasContext.font = "0.6rem times new roman";

    for(var i=0; i < particleArray.length; i++){

        //handle bounce 
        //makes cull unneccessary since particles are always kept within bounds
        if (particleArray[i].x < 0 || particleArray[i].x > window.innerWidth) {particleArray[i].xvel = bitwiseFlip(particleArray[i].xvel*bounceCoeff);}
        if (particleArray[i].y < 0 || particleArray[i].y > window.innerHeight) {particleArray[i].yvel = bitwiseFlip(particleArray[i].yvel*bounceCoeff);}
        
        //handle movement
        if (particleArray[i].xvel != 0) {particleArray[i].x += particleArray[i].xvel/particleArray[i].size;}
        if (particleArray[i].yvel != 0) {particleArray[i].y += particleArray[i].yvel/particleArray[i].size;}

        
        //velocity decay boilerplate
        if (particleArray[i].xvel < 0) {particleArray[i].xvel += 0.4;}
        else if (particleArray[i].xvel > 0) {particleArray[i].xvel -= 0.4;}
        if (Math.abs(particleArray[i].xvel) < deviationThreshold) {particleArray[i].xvel = 0;}

        if (particleArray[i].yvel < 0) {particleArray[i].yvel += 0.4;}
        else if (particleArray[i].yvel > 0) {particleArray[i].yvel -= 0.4;}
        if (Math.abs(particleArray[i].yvel) < deviationThreshold) {particleArray[i].yvel = 0;}

        //calculate cursor repulsive force
        var distBuffer = nodeDistancetoMouse(particleArray[i].x, particleArray[i].y);
        if (distBuffer < nodeActivationDistance) {
            particleArray[i].xvel -= xvelRelativetoCursor(particleArray[i].x)/40;
            particleArray[i].yvel -= yvelRelativetoCursor(particleArray[i].y)/40;
        }
        
        //draw routine
        canvasContext.beginPath();
        canvasContext.rect(particleArray[i].x, particleArray[i].y, particleArray[i].size, particleArray[i].size);
        canvasContext.fill();
        //canvasContext.beginPath(); 
        //canvasContext.arc(Cursor.xpos - offsetX, Cursor.ypos + offsetY, nodeActivationDistance, 0, 2*Math.PI);
        //canvasContext.stroke();
        //canvasContext.fillText("s: " + Math.floor(particleArray[i].size) + " | v: " + Math.floor(hypotenuse(particleArray[i].xvel, particleArray[i].yvel)), particleArray[i].x+10, particleArray[i].y+10);
    }    
    window.requestAnimationFrame(mousetests);
}

function inversemouse(){

    setInterval(function() {
        if (Math.random() <= 0.8 && particleArray.length < maxParticles*2) {
            particleArray.push({x:randrange(0,window.innerWidth),y:randrange(0,window.innerHeight),xvel:0,yvel:0,size:randrange(3,7)});}},1);

    let canvasitem = document.querySelector("canvas");

    //define drawable region
    canvasElement.width = canvasitem.offsetWidth;
    canvasElement.height = canvasitem.offsetHeight;

    //constants for draw
    canvasContext.fillStyle = "white";
    canvasContext.strokeStyle = "white";
    canvasContext.lineWidth = 1;

    canvasContext.font = "0.6rem times new roman";

    for(var i=0; i < particleArray.length; i++){

        //handle bounce 
        //makes cull unneccessary since particles are always kept within bounds
        if (particleArray[i].x < 0 || particleArray[i].x > window.innerWidth) {particleArray[i].xvel = bitwiseFlip(particleArray[i].xvel*bounceCoeff);}
        if (particleArray[i].y < 0 || particleArray[i].y > window.innerHeight) {particleArray[i].yvel = bitwiseFlip(particleArray[i].yvel*bounceCoeff);}
        
        //handle movement
        if (particleArray[i].xvel != 0) {particleArray[i].x += particleArray[i].xvel/particleArray[i].size;}
        if (particleArray[i].yvel != 0) {particleArray[i].y += particleArray[i].yvel/particleArray[i].size;}


        
        //velocity decay boilerplate
        if (particleArray[i].xvel < 0) {particleArray[i].xvel += 0.4;}
        else if (particleArray[i].xvel > 0) {particleArray[i].xvel -= 0.4;}
        if (Math.abs(particleArray[i].xvel) < deviationThreshold) {particleArray[i].xvel = 0;}

        if (particleArray[i].yvel < 0) {particleArray[i].yvel += 0.4;}
        else if (particleArray[i].yvel > 0) {particleArray[i].yvel -= 0.4;}
        if (Math.abs(particleArray[i].yvel) < deviationThreshold) {particleArray[i].yvel = 0;}
        

        //calculate cursor attraction force
        var distBuffer = nodeDistancetoMouse(particleArray[i].x, particleArray[i].y);
        if (distBuffer < nodeActivationDistance) {
            particleArray[i].xvel += xvelRelativetoCursor(particleArray[i].x)/30;
            particleArray[i].yvel += yvelRelativetoCursor(particleArray[i].y)/30;
        }
        
        //draw routine
        canvasContext.beginPath();
        canvasContext.rect(particleArray[i].x, particleArray[i].y, particleArray[i].size, particleArray[i].size);
        canvasContext.fill();
        canvasContext.beginPath(); 
        canvasContext.arc(Cursor.xpos - offsetX, Cursor.ypos + offsetY, nodeActivationDistance, 0, 2*Math.PI);
        canvasContext.stroke();
        //canvasContext.fillText("s: " + Math.floor(particleArray[i].size) + " | v: " + Math.floor(hypotenuse(particleArray[i].xvel, particleArray[i].yvel)), particleArray[i].x+10, particleArray[i].y+10);

    }    
    window.requestAnimationFrame(inversemouse);
}

function mousemixed(){

    setInterval(function() {
        if (Math.random() <= 0.8 && particleArray.length < maxParticles*1.5) {
            particleArray.push({x: randrange(0,window.innerWidth), y: randrange(0,window.innerHeight), xvel: 0, yvel: 0, size: randrange(3,7)});}},1);

    var canvasitem = document.querySelector("canvas");
    var context = document.querySelector("body");

    context.onmousedown = function(){m1down = !m1down;console.log("bye");}
    context.onmouseup = function(){m1down = !m1down; console.log("hi");}

    //define drawable region
    canvasElement.width = canvasitem.offsetWidth;
    canvasElement.height = canvasitem.offsetHeight;

    //constants for draw
    canvasContext.fillStyle = "white";
    canvasContext.strokeStyle = "rgba(255, 255, 255, 0.03)";
    canvasContext.lineWidth = 1;

    canvasContext.font = "0.8rem calibri";

    for(var i=0; i < particleArray.length; i++){

        //handle bounce 
        //makes cull unneccessary since particles are always kept within bounds
        if (particleArray[i].x < 0 || particleArray[i].x > window.innerWidth) {particleArray[i].xvel = bitwiseFlip(particleArray[i].xvel*bounceCoeff);}
        if (particleArray[i].y < 0 || particleArray[i].y > window.innerHeight) {particleArray[i].yvel = bitwiseFlip(particleArray[i].yvel*bounceCoeff);}
        
        //handle movement
        if (particleArray[i].xvel != 0) {particleArray[i].x += particleArray[i].xvel/particleArray[i].size;}
        if (particleArray[i].yvel != 0) {particleArray[i].y += particleArray[i].yvel/particleArray[i].size;}

        //bugfix: particles going above a certain speed get their velocity compounded by bounceCoeff on every loop
        if (Math.abs(particleArray[i].xvel) > cullThresholdX) {particleArray.splice(i,1);}
        if (Math.abs(particleArray[i].yvel) > cullThresholdY) {particleArray.splice(i,1);}

        
        //velocity decay boilerplate
        if (particleArray[i].xvel < 0) {particleArray[i].xvel += 0.4;}
        else if (particleArray[i].xvel > 0) {particleArray[i].xvel -= 0.4;}
        if (Math.abs(particleArray[i].xvel) < deviationThreshold) {particleArray[i].xvel = 0;}

        if (particleArray[i].yvel < 0) {particleArray[i].yvel += 0.4;}
        else if (particleArray[i].yvel > 0) {particleArray[i].yvel -= 0.4;}
        if (Math.abs(particleArray[i].yvel) < deviationThreshold) {particleArray[i].yvel = 0;}

        //calculate cursor repulsive force
        var distBuffer = nodeDistancetoMouse(particleArray[i].x, particleArray[i].y);
        if (m1down == true){
            if (distBuffer < nodeActivationDistance) {
                particleArray[i].xvel -= xvelRelativetoCursor(particleArray[i].x)/35;
                particleArray[i].yvel -= yvelRelativetoCursor(particleArray[i].y)/35;
            }
        } else {
            if (distBuffer < nodeActivationDistance) {
                particleArray[i].xvel += xvelRelativetoCursor(particleArray[i].x)/35;
                particleArray[i].yvel += yvelRelativetoCursor(particleArray[i].y)/35;
                canvasContext.beginPath(); 
                canvasContext.arc(Cursor.xpos - offsetX, Cursor.ypos + offsetY, nodeActivationDistance, 0, 2*Math.PI);
                canvasContext.stroke();
            }
        } 
        
        //draw routine
        canvasContext.beginPath();
        canvasContext.rect(particleArray[i].x, particleArray[i].y, particleArray[i].size, particleArray[i].size);
        canvasContext.fill();

        //canvasContext.fillText("s: " + Math.floor(particleArray[i].size) + " | v: " + Math.floor(hypotenuse(particleArray[i].xvel, particleArray[i].yvel)), particleArray[i].x+10, particleArray[i].y+10);
    }   
    canvasContext.fillText("framerate: "+ returnFPS(returnFrametime()), 20, 20);
    updateframetimeBuffer();
 
    window.requestAnimationFrame(mousemixed);
}

function smokeCell(){

        setInterval(function() {
        if (Math.random() <= 0.8 && particleArray.length < maxParticles*2) {
            particleArray.push({
                x:randrange(0,window.innerWidth),
                y:randrange(0,window.innerHeight),
                xvel:randrange(-20,20),
                yvel:randrange(-20,20),
                size:randrange(3,7)
            });}},1);
    
            let canvasitem = document.querySelector("canvas");

            //define drawable region
            canvasElement.width = canvasitem.offsetWidth;
            canvasElement.height = canvasitem.offsetHeight;
        
            //constants for draw
            canvasContext.fillStyle = "white";
            canvasContext.strokeStyle = "white";
            canvasContext.lineWidth = 1;    
            canvasContext.font = "0.6rem times new roman";
        
            //iterative simulation loop
            for(var i=0; i < particleArray.length; i++){
                
                
                //handle bounce 
                //makes cull unneccessary since particles are always kept within bounds
                if (particleArray[i].x < 0 || particleArray[i].x > window.innerWidth) {particleArray[i].xvel = bitwiseFlip(particleArray[i].xvel*bounceCoeff)+randrange(-2,2);}
                if (particleArray[i].y < 0 || particleArray[i].y > window.innerHeight) {particleArray[i].yvel = bitwiseFlip(particleArray[i].yvel*bounceCoeff)+randrange(-2,2);}

                //handle collision
                //brownian motion- assume all collisions are ELASTIC    
                //m1v1+m2v2=m1v1'+m2v2' where v1-v2=-(v1'-v2')


                
                //handle movement
                particleArray[i].x += particleArray[i].xvel/particleArray[i].size;
                particleArray[i].y += particleArray[i].yvel/particleArray[i].size;
        
        
                //draw routine
                //canvasContext.beginPath();
                //canvasContext.rect(particleArray[i].x, particleArray[i].y, particleArray[i].size, particleArray[i].size);
                //canvasContext.fill();
                drawDot(canvasContext, "white", particleArray[i].x, particleArray[i].y, particleArray[i].size);

                //canvasContext.fillText("s: " + Math.floor(particleArray[i].size) + " | v: " + Math.floor(hypotenuse(particleArray[i].xvel, particleArray[i].yvel)), particleArray[i].x+10, particleArray[i].y+10);
               }    
    canvasContext.fillStyle = "yellow";
    canvasContext.fillText("frametime: "+ returnAvgFrametime(returnFrametime()), 20, 20);
    updateframetimeBuffer();
    window.requestAnimationFrame(smokeCell);

}

function boid(){

    //fundamentals of a boid: 3 principles
    //every entity attempts to steer into the same path
    //every entity attempts to stay in the center of a flock
    //every entity avoids collision


    //factor: every entity also has a "fov" to detect what to follow in front of it
    //this could be leveraged for incredibly trivial culling

    //issue: every particle is iterated upon on a case-by-case basis
    //would need some sort of mechanism to buffer leader positions

    //unless a dedicated leader is spawned in and constantly kept track of?

    const leader= 5;
    const speedThreshold = 50;
    const padding = 200;

    const boidAttr= 400;
    const boidRepel= 100;

    setInterval(function() {
    if (Math.random() <= 0.8 && particleArray.length < maxParticles) {
        particleArray.push({
            x:randrange(0,window.innerWidth),
            y:randrange(0,window.innerHeight),
            xvel:randrange(-14,14),
            yvel:randrange(-14,14),
            size:randrange(1.5,3)
        });
    }},1);


    if (leaders.length == 0) {leaders.push({x:randrange(0,window.innerWidth),y:randrange(0,window.innerHeight),xvel:randrange(-8,8),yvel:randrange(-8,8),size:leader})};
        

    let canvasitem = document.querySelector("canvas");

    //define drawable region
    canvasElement.width = canvasitem.offsetWidth;
    canvasElement.height = canvasitem.offsetHeight;

    //constants for draw
    canvasContext.lineWidth = 1;    
    canvasContext.strokeStyle= "white";
    canvasContext.font = "0.6rem times new roman";


    //simulation loop for regular entities
    for(var i=0; i < particleArray.length; i++){
        
        //makes cull unneccessary since particles are always kept within bounds
        if (particleArray[i].x < 0 || particleArray[i].x > window.innerWidth) {particleArray[i].xvel += bitwiseFlip(particleArray[i].xvel*bounceCoeff);}
        if (particleArray[i].y < 0 || particleArray[i].y > window.innerHeight) {particleArray[i].yvel += bitwiseFlip(particleArray[i].yvel*bounceCoeff);}


        //handle movement ticks
        //particle vel scales with size, simulating "velocity"
        //todo: replicate "inertia", likely a function of decay/size
        const adjustedXvel = particleArray[i].xvel/particleArray[i].size;
        const adjustedYvel = particleArray[i].yvel/particleArray[i].size;
        particleArray[i].x += adjustedXvel;
        particleArray[i].y += adjustedYvel;

        if (particleArray[i].xvel < 0) {particleArray[i].xvel += decayRate;}
        else if (particleArray[i].xvel > 0) {particleArray[i].xvel -= decayRate;}
        if (Math.abs(particleArray[i].xvel) < deviationThreshold) {particleArray[i].xvel = 0;}

        if (particleArray[i].yvel < 0) {particleArray[i].yvel += decayRate;}
        else if (particleArray[i].yvel > 0) {particleArray[i].yvel -= decayRate;}
        if (Math.abs(particleArray[i].yvel) < deviationThreshold) {particleArray[i].yvel = 0;}


        var distBuffer = nodeDistancetoLeader(leaders[0].x, leaders[0].y, particleArray[i].x, particleArray[i].y);
        var pullCoeff = (boidAttr/distBuffer)/60;
        var pushCoeff = (boidRepel/distBuffer/60);

        if (distBuffer<boidAttr){
            particleArray[i].xvel += pullCoeff*xvelRelativetoLeader(particleArray[i].x); 
            particleArray[i].yvel += pullCoeff*yvelRelativetoLeader(particleArray[i].y);
        }

        if (distBuffer<boidRepel){
            particleArray[i].xvel -= pushCoeff*xvelRelativetoLeader(particleArray[i].x); 
            particleArray[i].yvel -= pushCoeff*yvelRelativetoLeader(particleArray[i].y);
        }


        //draw routine
        for (var n=0; n<7; n++){
            canvasContext.fillStyle = "rgba(255,255,255,"+(1-(n*0.11))+")";
            if (particleArray[i].size-(n*0.08)<0){break;}

            canvasContext.beginPath();
            canvasContext.arc(
                particleArray[i].x + (bitwiseFlip(particleArray[i].xvel)*(n*.16)), 
                particleArray[i].y + (bitwiseFlip(particleArray[i].yvel)*(n*.16)), 
                particleArray[i].size-(n*0.15), 
                0, 2*Math.PI);
            canvasContext.fill();
        }
        //canvasContext.fillText("d: " + distBuffer + " | v: " + Math.floor(hypotenuse(particleArray[i].xvel, particleArray[i].yvel)), particleArray[i].x+10, particleArray[i].y+10);
    }    




    leaders[0].x += leaders[0].xvel;
    leaders[0].y += leaders[0].yvel;


    if (leaders[0].x < 0+padding || leaders[0].x > window.innerWidth-padding) {leaders[0].xvel += bitwiseFlip(leaders[0].xvel)*0.2;}
    if (leaders[0].y < 0+padding || leaders[0].y > window.innerHeight-padding) {leaders[0].yvel += bitwiseFlip(leaders[0].yvel)*0.2;}


    leaders[0].xvel+= randrange(-1,1);
    leaders[0].yvel+= randrange(-1,1);


    if (leaders[0].xvel < 0) {leaders[0].xvel += decayRate;}
    else if (leaders[0].xvel > 0) {leaders[0].xvel -= decayRate;}
    if (Math.abs(leaders[0].xvel) < deviationThreshold) {leaders[0].xvel = 0;}

    if (leaders[0].yvel < 0) {leaders[0].yvel += decayRate;}
    else if (leaders[0].yvel > 0) {leaders[0].yvel -= decayRate;}
    if (Math.abs(leaders[0].yvel) < deviationThreshold) {leaders[0].yvel = 0;}



    for (var n=0; n<7; n++){
        canvasContext.fillStyle = "rgba(255,255,255,"+(1-(n*0.11))+")";
        if (leaders[0].size-(n*0.08)<0){break;}

        canvasContext.beginPath();
        canvasContext.arc(
            leaders[0].x + (bitwiseFlip(leaders[0].xvel)*(n*.7)), 
            leaders[0].y + (bitwiseFlip(leaders[0].yvel)*(n*.7)), 
            leaders[0].size-(n*0.15), 
            0, 2*Math.PI);
            canvasContext.fillText("s: " + leaders[0].size + " | v: " + Math.floor(hypotenuse(leaders[0].xvel, leaders[0].yvel)), leaders[0].x, leaders[0].y);

            canvasContext.fill();


        //canvasContext.beginPath(); 
        //canvasContext.arc(leaders[0].x, leaders[0].y, boidAttr, 0, 2*Math.PI);
        //canvasContext.arc(leaders[0].x, leaders[0].y, boidRepel, 0, 2*Math.PI);

        //canvasContext.stroke();

    }
    canvasContext.fillText("frametime: "+ returnFPS(returnFrametime()), 20, 20);
    updateframetimeBuffer();



    window.requestAnimationFrame(boid);

}

function spatialhash_random(){
    //optimized with spatiolhash
    //keyed: x|y=>indx of particle
    //potential: a sub-coordinate system where coordinate of cell is multiplied by multiplier
    //returning the absolute coordinate of the particle 


    //note: array access by indx: O(n)
    //can be took advantage of
    //particlearray k/v addition: region => regionname
    //spatialHash k/v addition: x-y(regionname) => particlearray indx 

    //in units of cells rather than px 
    var activationProximity= 3;


    //highlight queueing
    //useful when 
    var highlightQueue= [];

    //!!! for quick potential reaction to adjacency (skipping new region check) positions can be relative to cell rather than absolute
    //!!! in this way recalculations can be skipped for region updates
    //!!! drawback: recalculation is needed for every single particle in draw




    var canvasitem = document.querySelector("canvas");
    var context = document.querySelector("body");

    context.onmousedown = function(){m1down = !m1down;}
    context.onmouseup = function(){m1down = !m1down;}

    //define drawable region
    canvasElement.width = canvasitem.offsetWidth;
    canvasElement.height = canvasitem.offsetHeight;

    //constants for draw
    canvasContext.strokeStyle = "rgba(255, 255, 255, 0.03)";
    canvasContext.lineWidth = 0.4;
    canvasContext.font = "0.8rem calibri";

    //iter through every single particle
    for(var i=0; i < particleArray.length; i++){
        //check "adjacency" from spatialhash
        var adjacencyList= returnAdj(particleArray[i].region);





        //handle bounce 
        //if check spamming is massively reduced in this case due to spatial hash presence

        //bitwise flip check DOES NOT SUFFICE 
        //must only fire on edge region in specific situations
        if (regionisEdge(particleArray[i].region)){
            var edgeInfo= edgeFacing(particleArray[i].region);
            if (edgeInfo[0]!==undefined){
                if (returnScaledCoordinate(particleArray[i].x, 0, particleArray[i].region)<0 || returnScaledCoordinate(particleArray[i].x, 0, particleArray[i].region)>window.innerWidth){
                   particleArray[i].xvel = bitwiseFlip(particleArray[i].xvel);
                }
            }
            if (edgeInfo[1]!==undefined){
                if (returnScaledCoordinate(particleArray[i].y, 1, particleArray[i].region)<0 || returnScaledCoordinate(particleArray[i].y, 1, particleArray[i].region)>window.innerHeight){
                    particleArray[i].yvel = bitwiseFlip(particleArray[i].yvel);
                 }
            }

        } else {
            updateSpatialInfo(i, particleArray[i].region);

        }
        //handle movement
        particleArray[i].x += particleArray[i].xvel/(3*particleArray[i].size);
        particleArray[i].y += particleArray[i].yvel/(3*particleArray[i].size);

        //update relevant data for spatialhash 






        //finally, draw 
        //if (regionisEdge(particleArray[i].region)){
        //    drawDot_region(canvasContext, "red", particleArray[i].x, particleArray[i].y, particleArray[i].region, particleArray[i].size);
        //} else {
        //    drawDot_region(canvasContext, "white", particleArray[i].x, particleArray[i].y, particleArray[i].region, particleArray[i].size);
        //}
       
       
       
       
        pointlabel(canvasContext, i);
        drawDot_region(canvasContext, "white", particleArray[i].x, particleArray[i].y, particleArray[i].region, particleArray[i].size);
        
        //console.log(checkDirection(i));
        
        //highlightRegion(canvasContext, particleArray[i].region);


    }   

    //adjHighlight(canvasContext, 1);
    drawRegion(canvasContext);

    canvasContext.fillStyle = "yellow";
    //canvasContext.fillText("frametime: "+ returnAvgFrametime(returnFrametime()), 20, 20);
    canvasContext.fillText("framerate: "+ returnFPS(returnFrametime()), 20, 20);
    updateframetimeBuffer();
 
    window.requestAnimationFrame(spatialhash_random);
}

console.log("success!");

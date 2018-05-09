
<!DOCTYPE html>
<head>
	<link rel="stylesheet" href="css/main.css">
	<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
	<link rel="stylesheet" href="css/font-awesome.min.css">
</head>
<body style="overflow: hidden;">
	<header>
		 <div class="navbar navbar-dark bg-dark box-shadow">
			 <button type="button" class="btn btn-default navbar-btn pull-left">
				<span class="back">Back</span>
			</button>
			 <div class="container d-flex justify-content-between">
				 <a href="#" class="navbar-brand d-flex align-items-center">
					 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
					 <strong>Pikcells</strong>
				 </a>
			 </div>
		 </div>
	 </header>
	 <main role="main">
		 <section class="jumbotron text-center">
			 <div class="container">
				 <h1 class="jumbotron-heading">Pikcells Demos</h1>
				 <p class="lead text-muted">Here are some of the Demos for Pikcells</p>
			 </div>
		 </section>
		 <div class="album">
			 <div class="container">
				 <div class="row">
					 <div class="wrapper" style="position: absolute;">
				     <div class="wheel" id="sinkWheel" style="position: absolute"></div>
				     <div class="wheel" id="color" style="position: absolute"></div>
				     <canvas id="canvas" style="height: 1080px; width: 1920px;"></canvas>
				   </div>
				 </div>
			 </div>
		 </div>
	 </main>




  <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js" ></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js" integrity="sha384-ApNbgh9B+Y1QKtv3Rn7W3mgPxhU9K/ScQsAP7hUibX39j7fakFPskvXusvfa0b4Q" crossorigin="anonymous"></script>
  <script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0-beta.3/js/bootstrap.min.js" integrity="sha384-a5N7Y/aK3qNeh15eJKGWxsqtnX/wWdSZSKp+81YjTmS15nvnvxKHuzaWwXHDli+4" crossorigin="anonymous"></script>
  <script src="pikeng/three.js"></script>
  <script src="pikeng/loaders/PIKCTMLoader.js"></script>
  <script src="pikeng/pikeng.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/wheelnav@1.7.1/js/dist/raphael.min.js"></script>
  <script src="js/wheelNav.js"></script>
  <script src="js/radialMenu.js"></script>
  <script src="js/main.js"></script>
</body>
</html>

module.exports = function(grunt) {
	grunt.initConfig({

		less: {
			complile: {
				files:{
					'css/main.css' : 'less/main.less'
				}
			}
		},

		watch: {
			options:{
				livereload:true
			},

			less:{
				files:'less/*.less',
				tasks:'less'
			},
		},
		//console.log.writeln(express.all.options);
	});

	grunt.loadNpmTasks('grunt-contrib-less');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-livereload');

	grunt.registerTask('default', ['less']);
	grunt.registerTask('server', [ 'watch']);
};

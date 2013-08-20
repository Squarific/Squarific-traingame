var questions = document.getElementsByClassName("question");
for (var key = 0; key < questions.length; key++) {
	questions[key].addEventListener("click", function (event) {
		var target = event.target;
		if (!target.classList.contains("answer")) {
			for (var key = 0; key < target.children.length; key++) {
				if (target.children[key].classList && target.children[key].classList.contains("answer")) {
					target = target.children[key];
					break;
				}
			}
		}
		if (target.style.display !== "block") {
			target.style.display = "block";
		} else {
			target.style.display = "none";
		}
	});
}
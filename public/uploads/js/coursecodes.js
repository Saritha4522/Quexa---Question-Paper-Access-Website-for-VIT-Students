$(document).ready(function () {
  $("#courseCodeSelect").select2({
      placeholder: "Loading...",
      data: [],
  });

  // Show loading message
  $("#courseCodeSelect").html('<option value="" disabled selected>Select Course</option>');

  // Fetch unique course codes and populate the select2 dropdown
  fetch("/getUniqueCourseCodes")
      .then((response) => response.json())
      .then((data) => {
          $("#courseCodeSelect").select2({
              data: data.map((course) => ({ id: course, text: course })),
          });
      })
      .catch((error) => {
          console.error("Error fetching course codes:", error);
          // Display an error message if fetching fails
          $("#courseCodeSelect").html('<option value="" disabled selected>Error fetching data</option>');
      });
});

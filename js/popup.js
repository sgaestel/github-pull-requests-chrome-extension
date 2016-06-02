$(function() {
    var bgScript = chrome.extension.getBackgroundPage();

    // Allow opening links in a new tab
    $('body').on('click', 'a.link', function() {
        chrome.tabs.create({
            url: $(this).attr('href')
        });
        return false;
    });

    chrome.runtime.onMessage.addListener(function(prs) {
        createIssuesTableView(prs.type + "PullRequests", prs.prs);
    });

    var createIssuesTableView = function(containerName, issues) {
        // Create view for each PR
        var createIssueView = function(issue) {
            var $pullRequestLink = $("<a>", {
                class: "link",
                href: issue.html_url
            }).text("#" + issue.number + " - " + issue.title);

            var $projectView = $("<a>", {
                class: "link",
                href: issue.repository.owner.html_url + "/" + issue.repository.name
            }).text(issue.repository.full_name);

            var $assigneeView = function() {
                if (issue.assignee) {
                    return $("<img>", {
                        src: issue.assignee.avatar_url,
                        title: issue.assignee.login,
                        class: "assignee-img"
                    });
                }
                return null;
            }();

            return $("<tr>")
                .append(
                    $("<td>").append(
                        $assigneeView
                    ),
                    $("<td>").append(
                        $projectView
                    ),
                    $("<td>").append(
                        $pullRequestLink
                    )
                );
        };

        $("#" + containerName).empty();

        if (issues.length !== 0) {
            var $table = $("<table>", {
                class: "table"
            });
            $.each(issues, function(index, issue) {
                $table.append(createIssueView(issue));
            });
            $("#" + containerName).append($table);
        } else {
            $("#" + containerName).append($("<h5>").text("No Pull Request."));
        }

    };

    var toggleSettings = function() {
        $("#pullRequests").toggle();
        $("#settings").toggle();
    };

    $("#settingsBtn").on("click", function() {
        toggleSettings();
    });

    $("#applySettingsBtn").on("click", function() {
        Cookies.set("ghToken", $("#ghToken").val());
        bgScript.retrieveAssignedPRs();
        bgScript.retrieveCreatedPRs();
        toggleSettings();
    });

    // Allow refreshing the list of PRs
    $("#refreshPRlist").on("click", function() {
        bgScript.retrieveAssignedPRs();
        bgScript.retrieveCreatedPRs();
    });

    createIssuesTableView("assignedPullRequests", bgScript.getAssignedPRs());
    createIssuesTableView("createdPullRequests", bgScript.getCreatedPRs());
});

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
        createIssuesTableView(prs.type, prs.prs);
    });

    var createIssuesTableView = function(type, issues) {
        var containerName = type + "PullRequests";
        $("#" + type + "PRsCount").text(issues.length || "");
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

    $("#settingsBtn, #cancelSettingsBtn").on("click", function() {
        toggleSettings();
    });

    $("#applySettingsBtn").on("click", function() {
        if ($("#ghToken").val() !== "") {
            Cookies.set("ghToken", $("#ghToken").val());
        }
        if ($("#ghPollingInterval").val() !== "") {
            Cookies.set("ghPollingInterval", parseInt($("#ghPollingInterval").val()));
        }

        bgScript.retrieveAssignedPRs();
        bgScript.retrieveCreatedPRs();
        toggleSettings();
    });

    // Allow refreshing the list of PRs
    $("#refreshPRlist").on("click", function() {
        bgScript.retrieveAssignedPRs();
        bgScript.retrieveCreatedPRs();
    });

    // Init settings values
    $("#ghToken").val(Cookies.get("ghToken") || "");
    $("#ghPollingInterval").val(Cookies.get("ghPollingInterval") || 2);

    createIssuesTableView("assigned", bgScript.getAssignedPRs());
    createIssuesTableView("created", bgScript.getCreatedPRs());
});

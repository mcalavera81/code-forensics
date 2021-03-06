var Path   = require('path'),
    _      = require('lodash'),
    fs     = require('fs'),
    stream = require('stream');

var rubyTasks  = require_src('tasks/complexity_analysis/ruby'),
    vcsSupport = require_src('vcs_support'),
    command    = require_src('command');

describe('ruby tasks', function() {
  var repoDir, tempDir, outputDir;
  beforeEach(function() {
    repoDir = this.tasksWorkingFolders.repoDir;
    tempDir = this.tasksWorkingFolders.tempDir;
    outputDir = this.tasksWorkingFolders.outputDir;
    spyOn(command.Command, 'ensure');
  });

  describe('ruby-complexity-report', function() {
    afterEach(function() {
      this.clearRepo();
      this.clearTemp();
    });

    it('writes a report on the complexity for each ruby file in the repository', function(done) {
      var analysisStream1 = new stream.PassThrough();
      var analysisStream2 = new stream.PassThrough();
      spyOn(command, 'stream').and.returnValues(analysisStream1, analysisStream2);

      _.each(['test_file1.rb', 'test_file2.js', 'test_file3.rb'], function(f) {
        fs.writeFileSync(Path.join(repoDir, f), '');
      });

      var taskFunctions = this.tasksSetup(rubyTasks);
      taskFunctions['ruby-complexity-report']()
      .on('close', function() {
        var reportContent = fs.readFileSync(Path.join(tempDir, 'ruby-complexity-report.json'));
        var report = JSON.parse(reportContent.toString());
        expect(report.length).toEqual(2);
        expect(report).toContain({
          path: "test_file1.rb", totalComplexity: 22, averageComplexity: 7.3,
          methodComplexity: [
            { name: 'main#none', complexity: 18.6 },
            { name: 'chain#linking_to          /absolute/path/test_file1.rb:8', complexity: 1.7 }
          ]
        });
        expect(report).toContain({
          path: "test_file3.rb", totalComplexity: 95.1, averageComplexity: 8.6,
          methodComplexity: [
            { name: 'Module::TestFile2#test_method /absolute/path/test_file3.rb:54', complexity: 26.2 }
          ]
        });

        done();
      }).on('error', function(err) {
        fail(err);
      });

      analysisStream1.push(
        "\t22.0: flog total\n" +
        "\t 7.3: flog/method average\n" +
        "\n" +
        "\t18.6: main#none\n" +
        "\t 1.7: chain#linking_to          /absolute/path/test_file1.rb:8\n"
      );

      analysisStream2.push(
        "\t95.1: flog total\n" +
        "\t 8.6: flog/method average\n" +
        "\n" +
        "\t26.2: Module::TestFile2#test_method /absolute/path/test_file3.rb:54"
      );
      analysisStream1.end();
      analysisStream2.end();
    });
  });

  describe('ruby-complexity-trend-analysis', function() {
    var mockAdapter;

    beforeEach(function() {
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date('2015-10-22T10:00:00.000Z'));
      mockAdapter = jasmine.createSpyObj('vcsAdapter', ['revisions', 'showRevisionStream']);

      spyOn(vcsSupport, 'adapter').and.returnValue(mockAdapter);
    });

    afterEach(function() {
      jasmine.clock().uninstall();
      this.clearOutput();
    });

    it('publishes an analysis on the complexity trend for a given ruby file in the repository', function(done) {
      var revisionStream1 = new stream.PassThrough();
      var revisionStream2 = new stream.PassThrough();
      var complexityStream1 = new stream.PassThrough();
      var complexityStream2 = new stream.PassThrough();

      mockAdapter.revisions.and.returnValue([
        { revisionId: 123, date: '2015-04-29T23:00:00.000Z' },
        { revisionId: 456, date: '2015-05-04T23:00:00.000Z' }
      ]);
      mockAdapter.showRevisionStream.and.returnValues(revisionStream1, revisionStream2);
      spyOn(command, 'create').and.returnValue({
        asyncProcess: jasmine.createSpy().and.returnValues(
          { stdin: new stream.PassThrough(), stdout: complexityStream1 },
          { stdin: new stream.PassThrough(), stdout: complexityStream2 }
        )
      });

      var taskFunctions = this.tasksSetup(rubyTasks, null, { dateFrom: '2015-03-01', targetFile: 'test_abs.rb' });
      taskFunctions['ruby-complexity-trend-analysis']().then(function() {
        var reportContent = fs.readFileSync(Path.join(outputDir, 'd319335c98cc00b068ecd0927761ff3f3d693137', '2015-03-01_2015-10-22_complexity-trend-data.json'));
        var report = JSON.parse(reportContent.toString());
        expect(report.length).toEqual(2);
        expect(report).toContain({
          revision: 123,
          date: '2015-04-29T23:00:00.000Z',
          path: 'test_abs.rb',
          totalComplexity: 22.0,
          averageComplexity: 7.3,
          methodComplexity: [
            { name: 'main#none', complexity: 18.6 },
            { name: 'chain#linking_to          /absolute/path/test_abs.rb:8', complexity: 1.7 }
          ]
        });
        expect(report).toContain({
          revision: 456,
          date: '2015-05-04T23:00:00.000Z',
          path: 'test_abs.rb',
          totalComplexity: 95.1,
          averageComplexity: 8.6,
          methodComplexity: [
            { name: 'Module::TestFile2#test_method /absolute/path/test_abs.rb:54', complexity: 26.2 }
          ]
        });

        done();
      }).catch(function(err) {
        fail(err);
      });

      revisionStream1.push("def abs(a,b)\n");
      revisionStream1.push("a - b\nend");
      revisionStream1.end();

      revisionStream2.push("def abs(a,b)\n");
      revisionStream2.push("return b - a if (a < b)\n");
      revisionStream2.push("a - b\n");
      revisionStream2.push("end\n");
      revisionStream2.end();

      complexityStream1.push(
        "\t22.0: flog total\n" +
        "\t 7.3: flog/method average\n" +
        "\n" +
        "\t18.6: main#none\n" +
        "\t 1.7: chain#linking_to          /absolute/path/test_abs.rb:8\n"
      );
      complexityStream1.end();

      complexityStream2.push(
        "\t95.1: flog total\n" +
        "\t 8.6: flog/method average\n" +
        "\n" +
        "\t26.2: Module::TestFile2#test_method /absolute/path/test_abs.rb:54"
      );
      complexityStream2.end();
    });
  });
});
